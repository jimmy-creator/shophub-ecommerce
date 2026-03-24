import { Order, Product, User } from '../models/index.js';
import { Op } from 'sequelize';
import { sendOrderConfirmation, sendOrderStatusUpdate } from '../services/emailService.js';

const generateOrderNumber = () => {
  const prefix = 'ORD';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

export const createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items in order' });
    }

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

    const order = await Order.create({
      orderNumber: generateOrderNumber(),
      userId: req.user.id,
      items: orderItems,
      totalAmount,
      shippingAddress,
      paymentMethod,
    });

    // Reduce stock
    for (const item of items) {
      await Product.increment(
        { stock: -item.quantity },
        { where: { id: item.productId } }
      );
    }

    // Send confirmation email
    sendOrderConfirmation(order.toJSON(), req.user.email).catch(() => {});

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createGuestOrder = async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, guestEmail } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items in order' });
    }

    if (!guestEmail || !/\S+@\S+\.\S+/.test(guestEmail)) {
      return res.status(400).json({ message: 'Valid email is required for guest checkout' });
    }

    if (!shippingAddress?.fullName || !shippingAddress?.address || !shippingAddress?.phone) {
      return res.status(400).json({ message: 'Shipping address with name, address, and phone is required' });
    }

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

    const order = await Order.create({
      orderNumber: generateOrderNumber(),
      userId: null,
      guestEmail: guestEmail.toLowerCase().trim(),
      items: orderItems,
      totalAmount,
      shippingAddress,
      paymentMethod,
    });

    // Reduce stock
    for (const item of items) {
      await Product.increment(
        { stock: -item.quantity },
        { where: { id: item.productId } }
      );
    }

    // Send confirmation email to guest
    sendOrderConfirmation(order.toJSON(), guestEmail.toLowerCase().trim()).catch(() => {});

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const trackGuestOrder = async (req, res) => {
  try {
    const { orderNumber, email } = req.query;

    if (!orderNumber || !email) {
      return res.status(400).json({ message: 'Order number and email are required' });
    }

    const order = await Order.findOne({
      where: {
        orderNumber,
        guestEmail: email.toLowerCase().trim(),
      },
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getOrder = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin
export const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const where = {};
    if (status) where.orderStatus = status;

    const offset = (page - 1) * limit;
    const { count, rows } = await Order.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
    });

    res.json({
      orders: rows,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const { orderStatus, paymentStatus, trackingNumber } = req.body;
    const previousStatus = order.orderStatus;

    await order.update({
      ...(orderStatus && { orderStatus }),
      ...(paymentStatus && { paymentStatus }),
      ...(trackingNumber && { trackingNumber }),
    });

    // Send status update email if order status changed
    if (orderStatus && orderStatus !== previousStatus) {
      let email = order.guestEmail;
      if (!email && order.userId) {
        const customer = await User.findByPk(order.userId);
        if (customer) email = customer.email;
      }
      if (email) {
        sendOrderStatusUpdate(order.toJSON(), email).catch(() => {});
      }
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
