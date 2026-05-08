import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { HiShieldCheck, HiLockClosed, HiUser } from 'react-icons/hi';
import api from '../api/axios';
import { CURRENCY } from '../utils/currency';
import toast from 'react-hot-toast';

const toastStyle = {
  style: {
    background: '#1a1614', color: '#f5f0eb',
    fontSize: '0.88rem', fontFamily: "'Outfit', sans-serif", borderRadius: '4px',
  },
  iconTheme: { primary: '#c4784a', secondary: '#f5f0eb' },
};

function loadScript(src) {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function Checkout() {
  const { cart, cartTotal, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const processingPayment = useRef(false);
  const isGuest = !user;

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [showCoupons, setShowCoupons] = useState(false);

  // Tax state
  const [taxInfo, setTaxInfo] = useState({ totalTax: 0, breakdown: null });

  // Shipping state
  const [shippingOptions, setShippingOptions] = useState(null);
  const [shippingMethod, setShippingMethod] = useState('standard');

  const isStore2 = import.meta.env.VITE_LAYOUT === 'store2';
  const isStore3 = import.meta.env.VITE_LAYOUT === 'store3';

  // Pincode check (store3 only)
  const [pincodeCheck, setPincodeCheck] = useState(null);   // null | {available, message, city, state, deliveryDays, codAvailable}
  const [pincodeChecking, setPincodeChecking] = useState(false);
  const pincodeDebounce = useRef(null);
  const UAE_EMIRATES = [
    'Fujairah',
    'Abu Dhabi',
    'Dubai',
    'Sharjah',
    'Ajman',
    'Umm Al-Quwain',
    'Ras Al-Khaimah',
  ];

  const [form, setForm] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    address: '',
    city: '',
    state: isStore2 ? 'Fujairah' : '',
    zipCode: '',
    phone: user?.phone || '',
    paymentMethod: 'cod',
  });

  // Save abandoned cart when checkout page loads
  useEffect(() => {
    const email = user?.email || form.email;
    if (email && cart.length > 0) {
      api.post('/abandoned-cart/save', {
        email,
        items: cart.map((item) => ({ name: item.name, price: parseFloat(item.price), quantity: item.quantity })),
        cartTotal,
      }).catch(() => {});
    }
  }, [cart, user]);

  useEffect(() => {
    api.get('/coupons/available')
      .then((res) => setAvailableCoupons(Array.isArray(res.data) ? res.data : []))
      .catch(() => setAvailableCoupons([]));
  }, []);

  // Live-check pincode for store3 (debounced)
  useEffect(() => {
    if (!isStore3) return;
    const code = form.zipCode.trim();
    if (code.length < 4) { setPincodeCheck(null); setPincodeChecking(false); return; }

    clearTimeout(pincodeDebounce.current);
    setPincodeChecking(true);
    pincodeDebounce.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/pincodes/check/${encodeURIComponent(code)}`);
        setPincodeCheck(data);
        // Auto-fill city/state when blank
        if (data.available) {
          setForm((f) => ({
            ...f,
            city: f.city || data.city || f.city,
            state: f.state || data.state || f.state,
          }));
        }
      } catch {
        setPincodeCheck({ available: false, message: 'Unable to check delivery' });
      } finally {
        setPincodeChecking(false);
      }
    }, 600);

    return () => clearTimeout(pincodeDebounce.current);
  }, [form.zipCode, isStore3]);

  useEffect(() => {
    api.get('/payment/gateways')
      .then((res) => {
        setPaymentMethods(res.data);
      })
      .catch(() => {
        setPaymentMethods([
          { id: 'cod', name: 'Cash on Delivery', description: 'Pay when you receive your order' },
          { id: 'bank_transfer', name: 'Bank Transfer', description: 'Direct bank transfer' },
        ]);
      });
  }, [isGuest]);

  if (cart.length === 0 && !processingPayment.current) {
    navigate('/cart');
    return null;
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const successUrl = (orderNum, failed) => {
    let url = `/order-success?orderNumber=${orderNum}`;
    if (failed) url += '&status=failed';
    if (isGuest && form.email) url += `&email=${encodeURIComponent(form.email)}`;
    return url;
  };

  const getShippingAddress = () => ({
    fullName: form.fullName, address: form.address,
    city: form.city, state: form.state,
    zipCode: form.zipCode, phone: form.phone,
  });

  const handleApplyCoupon = async (codeOverride) => {
    const code = (codeOverride ?? couponCode).trim();
    if (!code) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const { data } = await api.post('/coupons/apply', {
        code,
        cartTotal,
        cartCategories: [...new Set(cart.map((item) => item.category))],
        cartProductIds: cart.map((item) => item.id),
        paymentMethod: form.paymentMethod,
      });
      setCouponApplied(data);
      setCouponCode(code);
      setCouponError('');
      setShowCoupons(false);
      toast.success(`Coupon applied: ${data.description}`, toastStyle);
    } catch (error) {
      setCouponError(error.response?.data?.message || 'Invalid coupon');
      setCouponApplied(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponApplied(null);
    setCouponCode('');
    setCouponError('');
  };

  // Fetch tax whenever state changes
  useEffect(() => {
    if (!form.state.trim()) { setTaxInfo({ totalTax: 0, breakdown: null }); return; }
    api.post('/payment/calculate-tax', {
      items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
      shippingState: form.state,
    }).then((res) => setTaxInfo(res.data)).catch(() => {});
  }, [form.state, cart]);

  // Fetch shipping rates
  useEffect(() => {
    const afterCoupon = Math.max(0, cartTotal - (couponApplied?.discount || 0));
    api.post('/payment/calculate-shipping', {
      subtotal: afterCoupon,
      itemCount: cart.reduce((s, i) => s + i.quantity, 0),
      shippingState: form.state,
    }).then((res) => setShippingOptions(res.data)).catch(() => {});
  }, [cartTotal, couponApplied, cart, form.state]);

  const discountAmount = couponApplied?.discount || 0;
  const taxAmount = taxInfo.totalTax || 0;

  const handleCODOrder = async () => {
    const orderData = {
      items: cart.map((item) => ({ productId: item.id, quantity: item.quantity, selectedVariant: item.selectedVariant || null })),
      shippingAddress: getShippingAddress(),
      shippingMethod,
      paymentMethod: form.paymentMethod,
      couponCode: couponApplied?.code || null,
    };

    if (isGuest) {
      orderData.guestEmail = form.email;
      const { data } = await api.post('/orders/guest', orderData);
      api.post('/abandoned-cart/recover', { email: form.email }).catch(() => {});
      navigate(successUrl(data.orderNumber));
      clearCart();
    } else {
      const { data } = await api.post('/orders', orderData);
      api.post('/abandoned-cart/recover', { email: user.email }).catch(() => {});
      navigate(successUrl(data.orderNumber));
      clearCart();
    }
  };

  const handleRazorpayPayment = async () => {
    const loaded = await loadScript('https://checkout.razorpay.com/v1/checkout.js');
    if (!loaded) {
      toast.error('Failed to load Razorpay. Check your internet connection.');
      return;
    }

    const createPayload = {
      items: cart.map((item) => ({ productId: item.id, quantity: item.quantity, selectedVariant: item.selectedVariant || null })),
      shippingAddress: getShippingAddress(),
      shippingMethod,
      gateway: 'razorpay',
      couponCode: couponApplied?.code || null,
    };
    if (isGuest) createPayload.guestEmail = form.email;

    const { data } = await api.post('/payment/create-order', createPayload);

    const { payment, order } = data;

    const options = {
      key: payment.key,
      amount: payment.amount,
      currency: payment.currency || 'INR',
      name: payment.name,
      description: payment.description,
      order_id: payment.orderId,
      prefill: {
        name: form.fullName,
        email: isGuest ? form.email : user.email,
        contact: form.phone,
      },
      notes: {
        order_number: order.orderNumber,
      },
      theme: { color: '#1a1614' },
      handler: async function (response) {
        try {
          const verifyRes = await api.post('/payment/verify', {
            orderNumber: order.orderNumber,
            gateway: 'razorpay',
            paymentData: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            },
          });

          if (verifyRes.data.verified) {
            navigate(successUrl(order.orderNumber));
            clearCart();
          } else {
            navigate(successUrl(order.orderNumber, true));
          }
        } catch (error) {
          navigate(successUrl(order.orderNumber, true));
        }
        setLoading(false);
      },
      modal: {
        confirm_close: true,
        ondismiss: function () {
          toast.error('Payment cancelled', toastStyle);
          setLoading(false);
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response) {
      console.error('Razorpay payment failed:', response.error);
      toast.error(response.error.description || 'Payment failed', toastStyle);
      setLoading(false);
    });
    processingPayment.current = true;
    rzp.open();
  };

  const handleStripePayment = async () => {
    const createPayload = {
      items: cart.map((item) => ({ productId: item.id, quantity: item.quantity, selectedVariant: item.selectedVariant || null })),
      shippingAddress: getShippingAddress(),
      shippingMethod,
      gateway: 'stripe',
      couponCode: couponApplied?.code || null,
    };
    if (isGuest) createPayload.guestEmail = form.email;

    const { data } = await api.post('/payment/create-order', createPayload);
    if (data.payment?.sessionUrl) {
      clearCart();
      window.location.href = data.payment.sessionUrl;
    } else {
      toast.error('Failed to create Stripe checkout session');
    }
  };

  const handleNomodPayment = async () => {
    const createPayload = {
      items: cart.map((item) => ({ productId: item.id, quantity: item.quantity, selectedVariant: item.selectedVariant || null })),
      shippingAddress: getShippingAddress(),
      shippingMethod,
      gateway: 'nomod',
      couponCode: couponApplied?.code || null,
    };
    if (isGuest) createPayload.guestEmail = form.email;

    const { data } = await api.post('/payment/create-order', createPayload);
    if (data.payment?.sessionUrl) {
      clearCart();
      window.location.href = data.payment.sessionUrl;
    } else {
      toast.error('Failed to create Nomod checkout session');
    }
  };

  const verifyPaytmOrder = async (orderNumber, paymentOrderId) => {
    try {
      const verifyRes = await api.post('/payment/verify', {
        orderNumber,
        gateway: 'paytm',
        paymentData: { orderId: paymentOrderId },
      });

      if (verifyRes.data.verified) {
        navigate(successUrl(orderNumber));
        clearCart();
        return true;
      } else {
        navigate(successUrl(orderNumber, true));
        return false;
      }
    } catch (error) {
      console.error('Paytm verify error:', error);
      navigate(successUrl(orderNumber, true));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handlePaytmPayment = async () => {
    const paytmPayload = {
      items: cart.map((item) => ({ productId: item.id, quantity: item.quantity, selectedVariant: item.selectedVariant || null })),
      shippingAddress: getShippingAddress(),
      shippingMethod,
      gateway: 'paytm',
      couponCode: couponApplied?.code || null,
    };
    if (isGuest) paytmPayload.guestEmail = form.email;

    const { data } = await api.post('/payment/create-order', paytmPayload);

    const { payment, order } = data;
    const scriptUrl = `${payment.baseUrl}/merchantpgpui/checkoutjs/merchants/${payment.mid}.js`;

    const loaded = await loadScript(scriptUrl);
    if (!loaded) {
      toast.error('Failed to load Paytm checkout. Check your internet connection.');
      setLoading(false);
      return;
    }

    let handled = false;

    const config = {
      root: '',
      flow: 'DEFAULT',
      data: {
        orderId: payment.orderId,
        token: payment.txnToken,
        tokenType: 'TXN_TOKEN',
        amount: payment.amount.toFixed(2),
      },
      handler: {
        notifyMerchant: function (eventName, eventData) {
          console.log('Paytm notifyMerchant:', eventName, eventData);
          if (eventName === 'APP_CLOSED') {
            if (!handled) {
              handled = true;
              verifyPaytmOrder(order.orderNumber, payment.orderId);
            }
          }
        },
        transactionStatus: function (response) {
          console.log('Paytm transactionStatus:', JSON.stringify(response));
          if (handled) return;
          handled = true;
          try {
            if (window.Paytm && window.Paytm.CheckoutJS) {
              window.Paytm.CheckoutJS.close();
            }
          } catch (e) {}
          verifyPaytmOrder(order.orderNumber, payment.orderId);
        },
      },
    };

    if (window.Paytm && window.Paytm.CheckoutJS) {
      window.Paytm.CheckoutJS.onLoad(function () {
        window.Paytm.CheckoutJS.init(config)
          .then(function () {
            processingPayment.current = true;
            window.Paytm.CheckoutJS.invoke();
          })
          .catch(function (error) {
            console.error('Paytm init error:', error);
            toast.error('Failed to initialize Paytm checkout');
            setLoading(false);
          });
      });
    } else {
      toast.error('Paytm checkout not available');
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isStore3) {
      if (!form.zipCode || form.zipCode.length < 4) {
        toast.error('Please enter a valid pincode');
        return;
      }
      if (pincodeChecking) {
        toast.error('Verifying pincode, please wait…');
        return;
      }
      if (pincodeCheck && !pincodeCheck.available) {
        toast.error(pincodeCheck.message || 'Delivery not available to this pincode');
        return;
      }
    }

    setLoading(true);

    try {
      const method = form.paymentMethod;

      if (method === 'cod' || method === 'bank_transfer') {
        await handleCODOrder();
      } else if (method === 'razorpay') {
        await handleRazorpayPayment();
      } else if (method === 'paytm') {
        await handlePaytmPayment();
      } else if (method === 'stripe') {
        await handleStripePayment();
      } else if (method === 'nomod') {
        await handleNomodPayment();
      } else {
        toast.error(`${method} gateway is not configured yet. Please choose another method.`);
        setLoading(false);
        return;
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const shipping = shippingOptions?.[shippingMethod]?.rate ?? 0;
  // Tax is inclusive in price — not added on top
  const grandTotal = Math.max(0, cartTotal - discountAmount + shipping);
  const isOnlinePayment = !['cod', 'bank_transfer'].includes(form.paymentMethod);

  return (
    <div className="checkout-page">
      <div className="container">
        <h1>Checkout</h1>

        {isGuest && (
          <div className="guest-banner">
            <div className="guest-banner-text">
              <HiUser />
              <span>You're checking out as a guest.</span>
            </div>
            <Link to="/login" className="guest-banner-link">Sign in for faster checkout</Link>
          </div>
        )}

        <form className="checkout-layout" onSubmit={handleSubmit}>
          {/* Section 1: Address */}
          <div className="checkout-section checkout-address">

            {isGuest && (
              <>
                <h3>Contact Information</h3>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="We'll send order confirmation here"
                    required
                  />
                </div>
              </>
            )}

            <h3>Shipping Address</h3>
            <div className="form-group">
              <label>Full Name</label>
              <input name="fullName" value={form.fullName} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Address</label>
              <input name="address" value={form.address} onChange={handleChange} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>City</label>
                <input name="city" value={form.city} onChange={handleChange} required />
              </div>
              <div className="form-group form-group-state">
                <label className="label-state">{isStore2 ? 'Emirate' : 'State'}</label>
                {isStore2 ? (
                  <select name="state" value={form.state} onChange={handleChange} required>
                    {UAE_EMIRATES.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                ) : (
                  <input name="state" value={form.state} onChange={handleChange} required />
                )}
              </div>
              <div className="form-group form-group-zipcode">
                <label>{isStore3 ? 'Pincode' : 'ZIP Code'}</label>
                <input
                  name="zipCode"
                  value={form.zipCode}
                  onChange={(e) => {
                    const v = isStore3 ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value;
                    setForm((f) => ({ ...f, zipCode: v }));
                    if (isStore3) setPincodeCheck(null);
                  }}
                  inputMode={isStore3 ? 'numeric' : undefined}
                  maxLength={isStore3 ? 6 : undefined}
                  placeholder={isStore3 ? '6-digit pincode' : ''}
                  required={isStore3}
                />
                {isStore3 && pincodeChecking && (
                  <p className="pincode-feedback checking">Checking delivery…</p>
                )}
                {isStore3 && !pincodeChecking && pincodeCheck && (
                  pincodeCheck.available ? (
                    <p className="pincode-feedback available">
                      ✓ {pincodeCheck.message}
                      {pincodeCheck.city && ` · ${pincodeCheck.city}${pincodeCheck.state ? ', ' + pincodeCheck.state : ''}`}
                      {pincodeCheck.codAvailable && ' · COD available'}
                    </p>
                  ) : (
                    <p className="pincode-feedback unavailable">✗ {pincodeCheck.message}</p>
                  )
                )}
              </div>
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} required />
            </div>
          </div>

          {/* Section 2: Payment */}
          <div className="checkout-section checkout-payment">
            <h3>Payment Method</h3>
            <div className="payment-options">
              {paymentMethods.map((method) => (
                <label key={method.id} className="payment-option">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method.id}
                    checked={form.paymentMethod === method.id}
                    onChange={handleChange}
                  />
                  <div className="payment-option-info">
                    <span className="payment-option-name">{method.name}</span>
                    <span className="payment-option-desc">{method.description}</span>
                  </div>
                </label>
              ))}
            </div>

            {isOnlinePayment && (
              <div className="payment-secure-note">
                <HiLockClosed />
                <span>Your payment is secured with 256-bit encryption</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading
                ? 'Processing...'
                : isOnlinePayment
                  ? `Pay ${CURRENCY}${grandTotal.toFixed(2)}`
                  : 'Place Order'
              }
            </button>
          </div>

          {/* Section 3: Order Summary */}
          <div className="order-summary checkout-summary">
            <h3>Order Summary</h3>
            {cart.map((item) => (
              <div key={item.cartKey} className="summary-item">
                <span>
                  {item.name}
                  {item.selectedVariant && ` (${Object.values(item.selectedVariant).join(', ')})`}
                  {' x '}{item.quantity}
                </span>
                <span>{CURRENCY}{(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            {/* Coupon Input */}
            <div className="coupon-section">
              {couponApplied ? (
                <div className="coupon-applied">
                  <div>
                    <span className="coupon-tag">{couponApplied.code}</span>
                    <span className="coupon-desc">{couponApplied.description}</span>
                  </div>
                  <button className="coupon-remove" onClick={handleRemoveCoupon}>&times;</button>
                </div>
              ) : (
                <>
                  <div className="coupon-input">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }}
                      placeholder="Coupon code"
                    />
                    <button onClick={() => handleApplyCoupon()} disabled={couponLoading}>
                      {couponLoading ? '...' : 'Apply'}
                    </button>
                  </div>
                  {availableCoupons.length > 0 && (
                    <button
                      type="button"
                      className="coupon-toggle"
                      onClick={() => setShowCoupons((s) => !s)}
                    >
                      {showCoupons ? 'Hide' : 'View'} {availableCoupons.length} available coupon{availableCoupons.length !== 1 ? 's' : ''}
                    </button>
                  )}
                  {showCoupons && (
                    <ul className="coupon-list">
                      {availableCoupons.map((c) => {
                        const valueLabel = c.type === 'percentage'
                          ? `${c.value}% off${c.maxDiscount ? ` (up to ${CURRENCY}${c.maxDiscount})` : ''}`
                          : `${CURRENCY}${c.value} off`;
                        const eligible = cartTotal >= c.minOrderAmount;
                        return (
                          <li key={c.code} className={`coupon-list-item ${!eligible ? 'is-locked' : ''}`}>
                            <div className="coupon-list-info">
                              <span className="coupon-tag">{c.code}</span>
                              <span className="coupon-list-value">{valueLabel}</span>
                              {c.description && <p className="coupon-list-desc">{c.description}</p>}
                              {c.minOrderAmount > 0 && (
                                <p className="coupon-list-meta">
                                  Min. order {CURRENCY}{c.minOrderAmount.toFixed(2)}
                                  {!eligible && ` · add ${CURRENCY}${(c.minOrderAmount - cartTotal).toFixed(2)} more`}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              className="coupon-list-apply"
                              onClick={() => handleApplyCoupon(c.code)}
                              disabled={couponLoading || !eligible}
                            >
                              Apply
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
              {couponError && <p className="coupon-error">{couponError}</p>}
            </div>

            <div className="summary-row">
              <span>Subtotal</span>
              <span>{CURRENCY}{cartTotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="summary-row discount-row">
                <span>Discount</span>
                <span>-{CURRENCY}{discountAmount.toFixed(2)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="summary-row" style={{ color: 'var(--text-light)', fontSize: '0.82rem' }}>
                <span>
                  Incl. GST
                  {taxInfo.breakdown && (
                    <span style={{ fontSize: '0.72rem', display: 'block', marginTop: '2px' }}>
                      {taxInfo.breakdown.isSameState
                        ? `CGST ${CURRENCY}${taxInfo.breakdown.cgst.toFixed(2)} + SGST ${CURRENCY}${taxInfo.breakdown.sgst.toFixed(2)}`
                        : `IGST ${CURRENCY}${taxInfo.breakdown.igst.toFixed(2)}`
                      }
                    </span>
                  )}
                </span>
                <span>{CURRENCY}{taxAmount.toFixed(2)}</span>
              </div>
            )}
            {shippingOptions && (
              <div className="shipping-options">
                <label
                  className={`shipping-option ${shippingMethod === 'standard' ? 'active' : ''}`}
                  onClick={() => setShippingMethod('standard')}
                >
                  <input type="radio" name="shipping" checked={shippingMethod === 'standard'} readOnly />
                  <div className="shipping-option-info">
                    <span className="shipping-option-name">{shippingOptions.standard.label}</span>
                    <span className="shipping-option-days">{shippingOptions.standard.days}</span>
                  </div>
                  <span className="shipping-option-price">
                    {shippingOptions.standard.rate === 0 ? 'Free' : `${CURRENCY}${shippingOptions.standard.rate.toFixed(2)}`}
                  </span>
                </label>
                <label
                  className={`shipping-option ${shippingMethod === 'express' ? 'active' : ''}`}
                  onClick={() => setShippingMethod('express')}
                >
                  <input type="radio" name="shipping" checked={shippingMethod === 'express'} readOnly />
                  <div className="shipping-option-info">
                    <span className="shipping-option-name">{shippingOptions.express.label}</span>
                    <span className="shipping-option-days">{shippingOptions.express.days}</span>
                  </div>
                  <span className="shipping-option-price">{CURRENCY}{shippingOptions.express.rate.toFixed(2)}</span>
                </label>
                {shippingOptions.amountForFree && (
                  <p className="shipping-free-hint">
                    {`Add ${CURRENCY}${shippingOptions.amountForFree.toFixed(2)} more for free shipping`}
                  </p>
                )}
              </div>
            )}
            <div className="summary-row total">
              <span>Total</span>
              <span>{CURRENCY}{grandTotal.toFixed(2)}</span>
            </div>

            <div className="checkout-trust">
              <HiShieldCheck style={{ color: 'var(--success)', fontSize: '1.1rem' }} />
              <span>Secure checkout guaranteed</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
