import Razorpay from 'razorpay';
import crypto from 'crypto';
import PaytmChecksum from 'paytmchecksum';

// ============================================
// Base Payment Gateway Interface
// ============================================
class PaymentGateway {
  async createOrder(amount, currency, receipt, notes) {
    throw new Error('createOrder not implemented');
  }
  async verifyPayment(paymentData) {
    throw new Error('verifyPayment not implemented');
  }
  getCheckoutConfig(order) {
    throw new Error('getCheckoutConfig not implemented');
  }
}

// ============================================
// RAZORPAY
// ============================================
class RazorpayGateway extends PaymentGateway {
  constructor() {
    super();
    this.instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  async createOrder(amount, currency = 'INR', receipt, notes = {}) {
    const customer = notes.customer || {};
    const options = {
      amount: Math.round(amount * 100), // Razorpay expects paise (subunits)
      currency,
      receipt,
      notes: {
        order_id: String(notes.orderId || ''),
        customer_name: customer.name || '',
        customer_email: customer.email || '',
      },
    };
    const order = await this.instance.orders.create(options);
    return {
      gatewayOrderId: order.id,
      amount: order.amount / 100,
      amountInSubunits: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
    };
  }

  async verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;

    return {
      verified: isValid,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
    };
  }

  getCheckoutConfig(order) {
    return {
      gateway: 'razorpay',
      key: process.env.RAZORPAY_KEY_ID,
      orderId: order.gatewayOrderId,
      amount: order.amountInSubunits, // paise
      currency: order.currency,
      name: process.env.STORE_NAME || 'ShopHub',
      description: `Order ${order.receipt}`,
    };
  }
}

// ============================================
// CASHFREE (Scaffold)
// ============================================
class CashfreeGateway extends PaymentGateway {
  constructor() {
    super();
    // Initialize with:
    // process.env.CASHFREE_APP_ID
    // process.env.CASHFREE_SECRET_KEY
    // process.env.CASHFREE_ENV ('sandbox' or 'production')
  }

  async createOrder(amount, currency = 'INR', receipt, notes = {}) {
    // Cashfree API: POST https://sandbox.cashfree.com/pg/orders
    // const response = await fetch(`${baseUrl}/pg/orders`, {
    //   method: 'POST',
    //   headers: {
    //     'x-api-version': '2023-08-01',
    //     'x-client-id': process.env.CASHFREE_APP_ID,
    //     'x-client-secret': process.env.CASHFREE_SECRET_KEY,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     order_id: receipt,
    //     order_amount: amount,
    //     order_currency: currency,
    //     customer_details: notes.customer || {},
    //   }),
    // });
    // const data = await response.json();
    // return {
    //   gatewayOrderId: data.cf_order_id,
    //   sessionId: data.payment_session_id,
    //   amount, currency, receipt,
    // };
    throw new Error('Cashfree integration requires CASHFREE_APP_ID and CASHFREE_SECRET_KEY in .env');
  }

  async verifyPayment(paymentData) {
    // Verify using Cashfree webhook signature or GET /pg/orders/{order_id}
    throw new Error('Cashfree verification not configured');
  }

  getCheckoutConfig(order) {
    return {
      gateway: 'cashfree',
      sessionId: order.sessionId,
      orderId: order.gatewayOrderId,
    };
  }
}

// ============================================
// PAYU (Scaffold)
// ============================================
class PayUGateway extends PaymentGateway {
  constructor() {
    super();
    // Initialize with:
    // process.env.PAYU_MERCHANT_KEY
    // process.env.PAYU_MERCHANT_SALT
    // process.env.PAYU_ENV ('test' or 'production')
  }

  async createOrder(amount, currency = 'INR', receipt, notes = {}) {
    // PayU uses form-based redirect, generate hash:
    // const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
    // const hash = crypto.createHash('sha512').update(hashString).digest('hex');
    // Return form data for redirect to PayU
    throw new Error('PayU integration requires PAYU_MERCHANT_KEY and PAYU_MERCHANT_SALT in .env');
  }

  async verifyPayment(paymentData) {
    throw new Error('PayU verification not configured');
  }

  getCheckoutConfig(order) {
    return { gateway: 'payu', formData: order.formData };
  }
}

// ============================================
// PHONEPE (Scaffold)
// ============================================
class PhonePeGateway extends PaymentGateway {
  constructor() {
    super();
    // Initialize with:
    // process.env.PHONEPE_MERCHANT_ID
    // process.env.PHONEPE_SALT_KEY
    // process.env.PHONEPE_SALT_INDEX
    // process.env.PHONEPE_ENV ('sandbox' or 'production')
  }

  async createOrder(amount, currency = 'INR', receipt, notes = {}) {
    // PhonePe Standard Checkout API
    // POST https://api.phonepe.com/apis/hermes/pg/v1/pay
    throw new Error('PhonePe integration requires PHONEPE_MERCHANT_ID and PHONEPE_SALT_KEY in .env');
  }

  async verifyPayment(paymentData) {
    throw new Error('PhonePe verification not configured');
  }

  getCheckoutConfig(order) {
    return { gateway: 'phonepe', redirectUrl: order.redirectUrl };
  }
}

// ============================================
// CCAVENUE (Scaffold)
// ============================================
class CCAvenueGateway extends PaymentGateway {
  constructor() {
    super();
    // Initialize with:
    // process.env.CCAVENUE_MERCHANT_ID
    // process.env.CCAVENUE_ACCESS_CODE
    // process.env.CCAVENUE_WORKING_KEY
  }

  async createOrder(amount, currency = 'INR', receipt, notes = {}) {
    // CCAvenue uses encrypted form redirect
    throw new Error('CCAvenue integration requires CCAVENUE_MERCHANT_ID and CCAVENUE_WORKING_KEY in .env');
  }

  async verifyPayment(paymentData) {
    throw new Error('CCAvenue verification not configured');
  }

  getCheckoutConfig(order) {
    return { gateway: 'ccavenue', encryptedData: order.encryptedData };
  }
}

// ============================================
// PAYTM (Full Implementation)
// ============================================
class PaytmGateway extends PaymentGateway {
  constructor() {
    super();
    this.merchantId = process.env.PAYTM_MERCHANT_ID;
    this.merchantKey = process.env.PAYTM_MERCHANT_KEY;
    this.env = process.env.PAYTM_ENV || 'staging';
    this.baseUrl = this.env === 'production'
      ? 'https://secure.paytmpayments.com'
      : 'https://securestage.paytmpayments.com';
  }

  async createOrder(amount, currency = 'INR', receipt, notes = {}) {
    const orderId = receipt;
    const customer = notes.customer || {};

    const body = {
      requestType: 'Payment',
      mid: this.merchantId,
      websiteName: this.env === 'production' ? 'DEFAULT' : 'WEBSTAGING',
      orderId: orderId,
      txnAmount: {
        value: amount.toFixed(2),
        currency: currency,
      },
      userInfo: {
        custId: String(notes.orderId || 'CUST_001'),
      },
      callbackUrl: `${process.env.SERVER_URL || 'http://localhost:3000'}/api/payment/paytm-callback`,
    };

    // Add optional fields only if they have values
    if (customer.email) body.userInfo.email = customer.email;
    if (customer.name) body.userInfo.firstName = customer.name.split(' ')[0];
    if (customer.phone) body.userInfo.mobile = customer.phone;

    const checksum = await PaytmChecksum.generateSignature(
      JSON.stringify(body),
      this.merchantKey
    );

    const paytmParams = {
      body,
      head: { signature: checksum },
    };

    const url = `${this.baseUrl}/theia/api/v1/initiateTransaction?mid=${this.merchantId}&orderId=${orderId}`;

    console.log('Paytm initiateTransaction URL:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paytmParams),
    });

    const data = await response.json();
    console.log('Paytm initiateTransaction response:', JSON.stringify(data));

    if (data.body?.resultInfo?.resultStatus === 'S') {
      return {
        gatewayOrderId: orderId,
        txnToken: data.body.txnToken,
        amount,
        currency,
        receipt: orderId,
      };
    } else {
      const msg = data.body?.resultInfo?.resultMsg || 'Failed to initiate Paytm transaction';
      const code = data.body?.resultInfo?.resultCode || 'UNKNOWN';
      throw new Error(`Paytm Error [${code}]: ${msg}`);
    }
  }

  async verifyPayment(paymentData) {
    const { orderId } = paymentData;

    const body = {
      mid: this.merchantId,
      orderId: orderId,
    };

    const checksum = await PaytmChecksum.generateSignature(
      JSON.stringify(body),
      this.merchantKey
    );

    const paytmParams = {
      body,
      head: { signature: checksum },
    };

    const url = `${this.baseUrl}/v3/order/status`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paytmParams),
    });

    const data = await response.json();
    console.log('Paytm order status response:', JSON.stringify(data));

    const isSuccess = data.body?.resultInfo?.resultStatus === 'TXN_SUCCESS';

    return {
      verified: isSuccess,
      paymentId: data.body?.txnId,
      orderId: data.body?.orderId,
      status: data.body?.resultInfo?.resultStatus,
      message: data.body?.resultInfo?.resultMsg,
    };
  }

  getCheckoutConfig(order) {
    return {
      gateway: 'paytm',
      mid: this.merchantId,
      orderId: order.gatewayOrderId,
      txnToken: order.txnToken,
      amount: order.amount,
      currency: order.currency,
      env: this.env,
      baseUrl: this.baseUrl,
    };
  }
}

// ============================================
// STRIPE
// ============================================
let _stripe = null;
let _stripeModule = null;
async function getStripeInstance() {
  if (!_stripe) {
    if (!_stripeModule) {
      _stripeModule = (await import('stripe')).default;
    }
    _stripe = new _stripeModule(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

class StripeGateway extends PaymentGateway {

  async createOrder(amount, currency = 'AED', receipt, notes = {}) {
    const customer = notes.customer || {};
    const session = await (await getStripeInstance()).checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: currency.toLowerCase(),
          product_data: { name: `Order ${receipt}` },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      customer_email: customer.email || undefined,
      metadata: { orderNumber: receipt, orderId: String(notes.orderId || '') },
      success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/order-success?orderNumber=${receipt}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout?cancelled=true`,
    });

    return {
      gatewayOrderId: session.id,
      sessionId: session.id,
      sessionUrl: session.url,
      amount,
      currency,
      receipt,
    };
  }

  async verifyPayment(paymentData) {
    const { sessionId } = paymentData;
    const session = await (await getStripeInstance()).checkout.sessions.retrieve(sessionId);
    return {
      verified: session.payment_status === 'paid',
      paymentId: session.payment_intent,
      orderId: session.metadata?.orderNumber,
      status: session.payment_status,
    };
  }

  getCheckoutConfig(order) {
    return {
      gateway: 'stripe',
      sessionId: order.sessionId,
      sessionUrl: order.sessionUrl,
      orderId: order.gatewayOrderId,
      amount: order.amount,
      currency: order.currency,
    };
  }
}

// ============================================
// NOMOD (Hosted Checkout — UAE)
// ============================================
class NomodGateway extends PaymentGateway {
  constructor() {
    super();
    this.apiKey = process.env.NOMOD_API_KEY;
    this.baseUrl = 'https://api.nomod.com';
    this.clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  }

  async createOrder(amount, currency = 'AED', receipt, notes = {}) {
    const customer = notes.customer || {};

    const body = {
      amount: parseFloat(amount.toFixed(2)),
      currency: currency.toUpperCase(),
      reference_id: receipt,
      success_url: `${this.clientUrl}/order-success?orderNumber=${receipt}&nomod_checkout_id={id}`,
      cancel_url: `${this.clientUrl}/checkout?cancelled=true`,
    };

    if (customer.name || customer.email || customer.phone) {
      body.customer = {};
      if (customer.name) {
        const [first, ...rest] = customer.name.split(' ');
        body.customer.first_name = first;
        if (rest.length) body.customer.last_name = rest.join(' ');
      }
      if (customer.email) body.customer.email = customer.email;
      if (customer.phone) body.customer.phone = customer.phone;
    }

    console.log('[Nomod] apiKey prefix:', this.apiKey?.slice(0, 10), '| length:', this.apiKey?.length);
    console.log('[Nomod] request body:', JSON.stringify(body));

    const response = await fetch(`${this.baseUrl}/v1/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Nomod error: ${JSON.stringify(data)}`);
    }

    return {
      gatewayOrderId: data.id,
      sessionId: data.id,
      sessionUrl: data.url || data.checkout_url || data.link,
      amount,
      currency,
      receipt,
    };
  }

  async verifyPayment({ sessionId }) {
    const response = await fetch(`${this.baseUrl}/v1/checkout/${sessionId}`, {
      headers: { 'X-API-KEY': this.apiKey },
    });

    const data = await response.json();

    // Nomod checkout statuses: paid, pending, expired, cancelled
    const isPaid = data.status === 'paid' || data.payment_status === 'paid';

    return {
      verified: isPaid,
      paymentId: data.charge_id || data.id,
      orderId: data.reference_id,
      status: data.status || data.payment_status,
    };
  }

  getCheckoutConfig(order) {
    return {
      gateway: 'nomod',
      sessionId: order.sessionId,
      sessionUrl: order.sessionUrl,
      orderId: order.gatewayOrderId,
      amount: order.amount,
      currency: order.currency,
    };
  }
}

// ============================================
// Gateway Factory
// ============================================
const gateways = {
  razorpay: RazorpayGateway,
  cashfree: CashfreeGateway,
  payu: PayUGateway,
  phonepe: PhonePeGateway,
  ccavenue: CCAvenueGateway,
  paytm: PaytmGateway,
  stripe: StripeGateway,
  nomod: NomodGateway,
};

export function getPaymentGateway(name) {
  const gatewayName = name || process.env.PAYMENT_GATEWAY || 'razorpay';
  const GatewayClass = gateways[gatewayName];
  if (!GatewayClass) {
    throw new Error(`Unknown payment gateway: ${gatewayName}. Available: ${Object.keys(gateways).join(', ')}`);
  }
  return new GatewayClass();
}

export function getAvailableGateways() {
  const available = [];

  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    available.push({ id: 'razorpay', name: 'Razorpay', description: 'Cards, UPI, Wallets, Net Banking' });
  }
  if (process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY) {
    available.push({ id: 'cashfree', name: 'Cashfree', description: 'Cards, UPI, Wallets, Net Banking' });
  }
  if (process.env.PAYU_MERCHANT_KEY && process.env.PAYU_MERCHANT_SALT) {
    available.push({ id: 'payu', name: 'PayU', description: 'Cards, UPI, Wallets, EMI' });
  }
  if (process.env.PHONEPE_MERCHANT_ID && process.env.PHONEPE_SALT_KEY) {
    available.push({ id: 'phonepe', name: 'PhonePe', description: 'UPI, Cards, Wallets' });
  }
  if (process.env.CCAVENUE_MERCHANT_ID && process.env.CCAVENUE_WORKING_KEY) {
    available.push({ id: 'ccavenue', name: 'CCAvenue', description: 'Cards, Net Banking, UPI, Wallets' });
  }
  if (process.env.PAYTM_MERCHANT_ID && process.env.PAYTM_MERCHANT_KEY) {
    available.push({ id: 'paytm', name: 'Paytm', description: 'UPI, Cards, Wallets, Net Banking' });
  }
  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY) {
    available.push({ id: 'stripe', name: 'Stripe', description: 'Cards, Apple Pay, Google Pay' });
  }
  if (process.env.NOMOD_API_KEY) {
    available.push({ id: 'nomod', name: 'Nomod', description: 'Cards, Apple Pay, Google Pay, Tabby, Tamara' });
  }

  return available;
}

export default { getPaymentGateway, getAvailableGateways };
