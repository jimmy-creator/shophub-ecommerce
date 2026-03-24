import nodemailer from 'nodemailer';

const smtpConfig = process.env.SMTP_HOST
  ? {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: parseInt(process.env.SMTP_PORT || '465') === 465,
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_APP_PASSWORD,
      },
    }
  : {
      service: 'gmail',
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_APP_PASSWORD,
      },
    };

const transporter = nodemailer.createTransport(smtpConfig);

const storeName = process.env.STORE_NAME || 'ShopHub';
const storeEmail = process.env.SMTP_EMAIL;

function formatPrice(amount) {
  return `₹${parseFloat(amount).toFixed(2)}`;
}

function orderItemsHTML(items) {
  return items.map((item) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e8e0d8;font-size:14px;color:#2c2420;">
        ${item.name}
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #e8e0d8;font-size:14px;color:#8a7e76;text-align:center;">
        ${item.quantity}
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #e8e0d8;font-size:14px;color:#2c2420;text-align:right;">
        ${formatPrice(item.price * item.quantity)}
      </td>
    </tr>
  `).join('');
}

function baseTemplate(content) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <!-- Header -->
    <div style="background:#1a1614;padding:28px 32px;border-radius:8px 8px 0 0;text-align:center;">
      <h1 style="margin:0;color:#f5f0eb;font-size:24px;font-weight:600;font-style:italic;letter-spacing:-0.5px;">
        ${storeName}
      </h1>
    </div>

    <!-- Content -->
    <div style="background:#ffffff;padding:32px;border:1px solid #e8e0d8;border-top:none;">
      ${content}
    </div>

    <!-- Footer -->
    <div style="background:#faf8f5;padding:20px 32px;border:1px solid #e8e0d8;border-top:none;border-radius:0 0 8px 8px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#8a7e76;">
        © ${new Date().getFullYear()} ${storeName}. All rights reserved.
      </p>
      <p style="margin:8px 0 0;font-size:12px;color:#b5aaa2;">
        If you have questions, reply to this email or contact us at ${storeEmail}
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ============================================
// ORDER CONFIRMATION
// ============================================
export async function sendOrderConfirmation(order, customerEmail) {
  const address = order.shippingAddress;
  const items = order.items;

  const html = baseTemplate(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="width:56px;height:56px;background:#dcfce7;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
        <span style="font-size:28px;">✓</span>
      </div>
      <h2 style="margin:0 0 4px;font-size:22px;color:#2c2420;">Order Confirmed!</h2>
      <p style="margin:0;font-size:14px;color:#8a7e76;">Thank you for your purchase</p>
    </div>

    <div style="background:#faf8f5;border:1px solid #e8e0d8;border-radius:6px;padding:16px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#8a7e76;">Order Number</td>
          <td style="padding:4px 0;font-size:13px;color:#2c2420;text-align:right;font-weight:600;">${order.orderNumber}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#8a7e76;">Date</td>
          <td style="padding:4px 0;font-size:13px;color:#2c2420;text-align:right;">${new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#8a7e76;">Payment Method</td>
          <td style="padding:4px 0;font-size:13px;color:#2c2420;text-align:right;text-transform:capitalize;">${order.paymentMethod}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#8a7e76;">Payment Status</td>
          <td style="padding:4px 0;font-size:13px;color:${order.paymentStatus === 'paid' ? '#5a8a6a' : '#c4784a'};text-align:right;text-transform:capitalize;font-weight:600;">${order.paymentStatus}</td>
        </tr>
      </table>
    </div>

    <h3 style="margin:0 0 12px;font-size:15px;color:#2c2420;text-transform:uppercase;letter-spacing:1px;">Items Ordered</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead>
        <tr style="background:#faf8f5;">
          <th style="padding:10px 16px;text-align:left;font-size:11px;color:#8a7e76;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e8e0d8;">Item</th>
          <th style="padding:10px 16px;text-align:center;font-size:11px;color:#8a7e76;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e8e0d8;">Qty</th>
          <th style="padding:10px 16px;text-align:right;font-size:11px;color:#8a7e76;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e8e0d8;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${orderItemsHTML(items)}
      </tbody>
    </table>

    <div style="border-top:2px solid #1a1614;padding-top:12px;text-align:right;">
      <span style="font-size:16px;font-weight:700;color:#2c2420;">Total: ${formatPrice(order.totalAmount)}</span>
    </div>

    <h3 style="margin:24px 0 8px;font-size:15px;color:#2c2420;text-transform:uppercase;letter-spacing:1px;">Shipping Address</h3>
    <div style="background:#faf8f5;border:1px solid #e8e0d8;border-radius:6px;padding:16px;font-size:14px;color:#2c2420;line-height:1.6;">
      ${address.fullName}<br>
      ${address.address}<br>
      ${address.city}, ${address.state} ${address.zipCode}<br>
      Phone: ${address.phone}
    </div>
  `);

  return sendEmail(customerEmail, `Order Confirmed - ${order.orderNumber}`, html);
}

// ============================================
// ORDER STATUS UPDATE
// ============================================
export async function sendOrderStatusUpdate(order, customerEmail) {
  const statusMessages = {
    confirmed: { emoji: '✓', title: 'Order Confirmed', desc: 'Your order has been confirmed and is being prepared.', color: '#3b82f6' },
    shipped: { emoji: '📦', title: 'Order Shipped', desc: 'Your order is on its way!', color: '#8b5cf6' },
    delivered: { emoji: '✅', title: 'Order Delivered', desc: 'Your order has been delivered. Enjoy!', color: '#10b981' },
    cancelled: { emoji: '✕', title: 'Order Cancelled', desc: 'Your order has been cancelled.', color: '#ef4444' },
  };

  const status = statusMessages[order.orderStatus] || { emoji: '📋', title: 'Order Update', desc: `Your order status is now: ${order.orderStatus}`, color: '#8a7e76' };

  const html = baseTemplate(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="width:56px;height:56px;background:${status.color}15;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
        <span style="font-size:28px;">${status.emoji}</span>
      </div>
      <h2 style="margin:0 0 4px;font-size:22px;color:#2c2420;">${status.title}</h2>
      <p style="margin:0;font-size:14px;color:#8a7e76;">${status.desc}</p>
    </div>

    <div style="background:#faf8f5;border:1px solid #e8e0d8;border-radius:6px;padding:16px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#8a7e76;">Order Number</td>
          <td style="padding:4px 0;font-size:13px;color:#2c2420;text-align:right;font-weight:600;">${order.orderNumber}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#8a7e76;">Status</td>
          <td style="padding:4px 0;font-size:13px;color:${status.color};text-align:right;font-weight:600;text-transform:capitalize;">${order.orderStatus}</td>
        </tr>
        ${order.trackingNumber && order.orderStatus === 'shipped' ? `
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#8a7e76;">Tracking Number</td>
          <td style="padding:4px 0;font-size:13px;color:#2c2420;text-align:right;font-weight:600;">${order.trackingNumber}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#8a7e76;">Total</td>
          <td style="padding:4px 0;font-size:13px;color:#2c2420;text-align:right;font-weight:600;">${formatPrice(order.totalAmount)}</td>
        </tr>
      </table>
    </div>
  `);

  return sendEmail(customerEmail, `${status.title} - ${order.orderNumber}`, html);
}

// ============================================
// PAYMENT CONFIRMATION
// ============================================
export async function sendPaymentConfirmation(order, customerEmail) {
  const html = baseTemplate(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="width:56px;height:56px;background:#dcfce7;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
        <span style="font-size:28px;">💳</span>
      </div>
      <h2 style="margin:0 0 4px;font-size:22px;color:#2c2420;">Payment Received</h2>
      <p style="margin:0;font-size:14px;color:#8a7e76;">We've received your payment of ${formatPrice(order.totalAmount)}</p>
    </div>

    <div style="background:#faf8f5;border:1px solid #e8e0d8;border-radius:6px;padding:16px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#8a7e76;">Order Number</td>
          <td style="padding:4px 0;font-size:13px;color:#2c2420;text-align:right;font-weight:600;">${order.orderNumber}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#8a7e76;">Amount Paid</td>
          <td style="padding:4px 0;font-size:13px;color:#5a8a6a;text-align:right;font-weight:600;">${formatPrice(order.totalAmount)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#8a7e76;">Payment Method</td>
          <td style="padding:4px 0;font-size:13px;color:#2c2420;text-align:right;text-transform:capitalize;">${order.paymentMethod}</td>
        </tr>
      </table>
    </div>
  `);

  return sendEmail(customerEmail, `Payment Received - ${order.orderNumber}`, html);
}

// ============================================
// SEND EMAIL HELPER
// ============================================
async function sendEmail(to, subject, html) {
  if (!process.env.SMTP_EMAIL || !process.env.SMTP_APP_PASSWORD) {
    console.log(`[Email skipped] No SMTP config. Would send to ${to}: ${subject}`);
    return null;
  }

  try {
    const info = await transporter.sendMail({
      from: `"${storeName}" <${storeEmail}>`,
      to,
      subject,
      html,
    });
    console.log(`[Email sent] ${subject} → ${to} (${info.messageId})`);
    return info;
  } catch (error) {
    console.error(`[Email failed] ${subject} → ${to}:`, error.message);
    return null;
  }
}

export default { sendOrderConfirmation, sendOrderStatusUpdate, sendPaymentConfirmation };
