import { Router } from 'express';
import { protect, optionalAuth } from '../middleware/auth.js';
import { Order, Product, User } from '../models/index.js';
import { getPaymentGateway, getAvailableGateways } from '../services/paymentGateway.js';
import { sendOrderConfirmation, sendPaymentConfirmation } from '../services/emailService.js';
import { Op } from 'sequelize';

const router = Router();

// Get available payment gateways
router.get('/gateways', (req, res) => {
  const gateways = getAvailableGateways();

  // Always include COD
  const allMethods = [
    { id: 'cod', name: 'Cash on Delivery', description: 'Pay when you receive your order' },
    { id: 'bank_transfer', name: 'Bank Transfer', description: 'Direct bank transfer' },
    ...gateways,
  ];

  res.json(allMethods);
});

// Create payment order
router.post('/create-order', optionalAuth, async (req, res) => {
  try {
    const { items, shippingAddress, gateway = process.env.PAYMENT_GATEWAY || 'razorpay', guestEmail } = req.body;
    const isGuest = !req.user;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items provided' });
    }

    if (isGuest && (!guestEmail || !/\S+@\S+\.\S+/.test(guestEmail))) {
      return res.status(400).json({ message: 'Valid email is required for guest checkout' });
    }

    // Calculate total from DB prices (never trust client-side amounts)
    const productIds = items.map((item) => item.productId);
    const products = await Product.findAll({
      where: { id: { [Op.in]: productIds } },
    });

    let totalAmount = 0;
    const orderItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);
      if (product.stock < item.quantity) {
        throw new Error(`${product.name} is out of stock`);
      }
      const itemTotal = parseFloat(product.price) * item.quantity;
      totalAmount += itemTotal;
      return {
        productId: product.id,
        name: product.name,
        price: parseFloat(product.price),
        quantity: item.quantity,
        image: product.images?.[0] || null,
      };
    });

    // Add shipping
    const shipping = totalAmount >= 50 ? 0 : 5.99;
    totalAmount += shipping;

    // Generate order number
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Create order in DB with pending payment
    const order = await Order.create({
      orderNumber,
      userId: isGuest ? null : req.user.id,
      guestEmail: isGuest ? guestEmail.toLowerCase().trim() : null,
      items: orderItems,
      totalAmount,
      shippingAddress,
      paymentMethod: gateway,
      paymentStatus: 'pending',
      orderStatus: 'processing',
    });

    const customerName = isGuest ? shippingAddress.fullName : req.user.name;
    const customerEmail = isGuest ? guestEmail : req.user.email;
    const customerPhone = shippingAddress.phone || (isGuest ? '' : req.user.phone || '');

    // Create gateway payment order
    const paymentGateway = getPaymentGateway(gateway);
    const gatewayOrder = await paymentGateway.createOrder(
      totalAmount,
      'INR',
      orderNumber,
      {
        orderId: order.id,
        customer: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
        },
      }
    );

    // Save gateway order ID
    await order.update({ trackingNumber: gatewayOrder.gatewayOrderId });

    // Return checkout config
    const checkoutConfig = paymentGateway.getCheckoutConfig(gatewayOrder);

    res.json({
      order: order.toJSON(),
      payment: {
        ...checkoutConfig,
        orderNumber,
        amount: totalAmount,
      },
    });
  } catch (error) {
    console.error('Payment create-order error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Verify payment
router.post('/verify', optionalAuth, async (req, res) => {
  try {
    const { orderNumber, gateway = process.env.PAYMENT_GATEWAY || 'razorpay', paymentData } = req.body;

    const where = { orderNumber };
    if (req.user) {
      where.userId = req.user.id;
    }
    const order = await Order.findOne({ where });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.paymentStatus === 'paid') {
      return res.json({ verified: true, order });
    }

    const paymentGateway = getPaymentGateway(gateway);
    const result = await paymentGateway.verifyPayment(paymentData);

    console.log('Payment verify result:', result);

    if (result.verified) {
      await order.update({
        paymentStatus: 'paid',
        orderStatus: 'confirmed',
      });

      // Reduce stock
      for (const item of order.items) {
        await Product.increment(
          { stock: -item.quantity },
          { where: { id: item.productId } }
        );
      }

      // Send payment + order confirmation emails
      let email = order.guestEmail;
      if (!email && req.user) email = req.user.email;
      if (!email && order.userId) {
        const customer = await User.findByPk(order.userId);
        if (customer) email = customer.email;
      }
      if (email) {
        sendPaymentConfirmation(order.toJSON(), email).catch(() => {});
        sendOrderConfirmation(order.toJSON(), email).catch(() => {});
      }

      res.json({ verified: true, order: order.toJSON(), status: result.status });
    } else if (result.status === 'PENDING') {
      // Payment is still processing (common in test mode)
      res.json({ verified: false, pending: true, status: 'PENDING', message: 'Payment is being processed' });
    } else {
      await order.update({ paymentStatus: 'failed' });
      res.json({ verified: false, status: result.status, message: result.message || 'Payment verification failed' });
    }
  } catch (error) {
    console.error('Payment verify error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Payment webhook (for server-to-server callbacks)
router.post('/webhook/:gateway', async (req, res) => {
  try {
    // Each gateway sends different webhook formats
    // For Razorpay: validate webhook signature using X-Razorpay-Signature header
    const { gateway } = req.params;
    console.log(`Webhook received for ${gateway}:`, JSON.stringify(req.body).substring(0, 200));

    // Acknowledge receipt
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ status: 'error' });
  }
});

// Paytm browser callback — Paytm POSTs here after payment, then we redirect to frontend
router.post('/paytm-callback', async (req, res) => {
  try {
    const { ORDERID, STATUS, TXNID } = req.body;
    console.log('Paytm callback:', { ORDERID, STATUS, TXNID });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    if (STATUS === 'TXN_SUCCESS') {
      // Verify and confirm the order
      const order = await Order.findOne({ where: { orderNumber: ORDERID } });
      if (order && order.paymentStatus !== 'paid') {
        const paymentGateway = getPaymentGateway('paytm');
        const result = await paymentGateway.verifyPayment({ orderId: ORDERID });

        if (result.verified) {
          await order.update({ paymentStatus: 'paid', orderStatus: 'confirmed' });
          for (const item of order.items) {
            await Product.increment({ stock: -item.quantity }, { where: { id: item.productId } });
          }

          // Send emails
          let email = order.guestEmail;
          if (!email && order.userId) {
            const customer = await User.findByPk(order.userId);
            if (customer) email = customer.email;
          }
          if (email) {
            sendPaymentConfirmation(order.toJSON(), email).catch(() => {});
            sendOrderConfirmation(order.toJSON(), email).catch(() => {});
          }
        }
      }
      res.redirect(`${clientUrl}/order-success?orderNumber=${ORDERID}`);
    } else {
      res.redirect(`${clientUrl}/order-success?orderNumber=${ORDERID}&status=failed`);
    }
  } catch (error) {
    console.error('Paytm callback error:', error);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/orders`);
  }
});

export default router;
