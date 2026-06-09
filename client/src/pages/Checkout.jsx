import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { localizedCurrency } from '../utils/i18nHelpers';
import { formatPrice } from '../utils/currency';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { HiShieldCheck, HiLockClosed, HiUser, HiChevronDown, HiOutlineQuestionMarkCircle } from 'react-icons/hi';
import api from '../api/axios';
import toast from 'react-hot-toast';

// Shopify-style floating-label text field (store4 Delivery form).
function S4Field({ label, optional, optionalText = '(optional)', name, value, onChange, type = 'text', required, inputMode, maxLength, help }) {
  return (
    <div className="s4f-field">
      <input
        className="s4f-input" id={`s4-${name}`} name={name} type={type}
        value={value} onChange={onChange} placeholder=" "
        required={required} inputMode={inputMode} maxLength={maxLength}
        autoComplete="off"
      />
      <label className="s4f-label" htmlFor={`s4-${name}`}>{label}{optional ? ` ${optionalText}` : ''}</label>
      {help && <span className="s4f-help" title={help}><HiOutlineQuestionMarkCircle size={20} /></span>}
    </div>
  );
}

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
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const shipDays = (opt) => (isAr && opt?.daysAr ? opt.daysAr : opt?.days);
  // Locale-aware currency symbol; re-evaluates per render when locale flips.
  const cur = localizedCurrency();
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
  const isStore4 = import.meta.env.VITE_LAYOUT === 'store4';   // Kuwait — no postal codes, no state

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
  const KUWAIT_GOVERNORATES = [
    'Al Asimah (Capital)',
    'Hawally',
    'Farwaniya',
    'Mubarak Al-Kabeer',
    'Ahmadi',
    'Jahra',
  ];

  const [form, setForm] = useState({
    fullName: user?.name || '',
    firstName: isStore4 ? (user?.name?.split(' ')[0] || '') : '',
    lastName: isStore4 ? (user?.name?.split(' ').slice(1).join(' ') || '') : '',
    email: user?.email || '',
    address: '',
    apartment: '',
    city: '',
    // store4 (Kuwait) starts unselected so the governorate label acts as a placeholder.
    state: isStore2 ? 'Fujairah' : '',
    zipCode: '',
    phone: user?.phone || '',
    paymentMethod: 'cod',
  });
  const [saveInfo, setSaveInfo] = useState(false);

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

  // Prefill the store4 delivery form from a previous "save this information".
  useEffect(() => {
    if (!isStore4) return;
    try {
      const saved = JSON.parse(localStorage.getItem('store4_delivery') || 'null');
      if (!saved) return;
      setForm((f) => ({
        ...f, ...saved,
        fullName: `${saved.firstName || ''} ${saved.lastName || ''}`.trim() || f.fullName,
      }));
      setSaveInfo(true);
    } catch { /* ignore corrupt storage */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (cart.length === 0 && !processingPayment.current) {
    navigate('/cart');
    return null;
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // store4 splits the name into first/last; keep fullName in sync for the
  // rest of the flow (payment customer name, shipping address, invoice).
  const handleNameChange = (e) => {
    setForm((f) => {
      const next = { ...f, [e.target.name]: e.target.value };
      next.fullName = `${next.firstName || ''} ${next.lastName || ''}`.trim();
      return next;
    });
  };

  const successUrl = (orderNum, failed) => {
    let url = `/order-success?orderNumber=${orderNum}`;
    if (failed) url += '&status=failed';
    if (isGuest && form.email) url += `&email=${encodeURIComponent(form.email)}`;
    return url;
  };

  const getShippingAddress = () => {
    if (isStore4) {
      return {
        fullName: form.fullName,
        address: [form.address, form.apartment].filter(Boolean).join(', '),
        city: form.city, state: form.state, zipCode: form.zipCode,
        phone: form.phone, country: 'Kuwait',
      };
    }
    return {
      fullName: form.fullName, address: form.address,
      city: form.city, state: form.state,
      zipCode: form.zipCode, phone: form.phone,
    };
  };

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

  const handleTapPayment = async () => {
    const createPayload = {
      items: cart.map((item) => ({ productId: item.id, quantity: item.quantity, selectedVariant: item.selectedVariant || null })),
      shippingAddress: getShippingAddress(),
      shippingMethod,
      gateway: 'tap',
      couponCode: couponApplied?.code || null,
    };
    if (isGuest) createPayload.guestEmail = form.email;

    const { data } = await api.post('/payment/create-order', createPayload);
    if (data.payment?.sessionUrl) {
      clearCart();
      window.location.href = data.payment.sessionUrl;
    } else {
      toast.error('Failed to create Tap checkout session');
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

    if (isStore4) {
      if (saveInfo) {
        localStorage.setItem('store4_delivery', JSON.stringify({
          firstName: form.firstName, lastName: form.lastName, email: form.email,
          address: form.address, apartment: form.apartment, city: form.city,
          state: form.state, zipCode: form.zipCode, phone: form.phone,
        }));
      } else {
        localStorage.removeItem('store4_delivery');
      }
    }

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
      } else if (method === 'tap') {
        await handleTapPayment();
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
    <div className={`checkout-page${isStore4 ? ' s4-checkout' : ''}`}>
      {isStore4 && (
        <style>{`
          .s4-checkout { --anfal-blue: #1e3a8a; --anfal-bright: #1a64e8; background: #f5f6f8; }
          .s4-checkout .container { max-width: 1120px; }
          .s4-checkout > .container > h1 { display: none; }
          .s4-co-header {
            display: flex; align-items: center; gap: 14px;
            padding: 0.25rem 0 1.4rem; margin-bottom: 1.7rem; border-bottom: 1px solid #e7e9ed;
          }
          .s4-co-logo { height: 42px; width: auto; }
          .s4-co-secure {
            margin-left: auto; display: inline-flex; align-items: center; gap: 6px;
            color: #16a34a; font-size: 0.85rem; font-weight: 600;
          }
          [dir="rtl"] .s4-co-secure { margin-left: 0; margin-right: auto; }
          .s4-checkout .checkout-layout { gap: 2rem; align-items: start; }
          .s4-checkout .checkout-section,
          .s4-checkout .checkout-summary {
            background: #fff !important; border: 1px solid #e6e8eb !important;
            border-radius: 16px !important; padding: 1.6rem 1.5rem !important;
            box-shadow: 0 1px 3px rgba(16,24,40,0.05) !important; backdrop-filter: none !important;
          }
          .s4-checkout .checkout-section h3,
          .s4-checkout .checkout-summary h3 {
            color: #111827 !important; font-weight: 700; font-size: 1.15rem;
            border: none !important; padding: 0 !important;
          }
          .s4-checkout .checkout-summary h3 { margin-bottom: 1rem; }
          /* Payment options → modern selectable cards */
          .s4-checkout .payment-option {
            border: 1px solid #d8dce1 !important; border-radius: 12px !important;
            padding: 14px 16px !important; margin-bottom: 10px;
            background: #fff !important; transition: border-color .15s, box-shadow .15s;
          }
          .s4-checkout .payment-option:hover { border-color: #9bb4f5 !important; }
          .s4-checkout .payment-option:has(input:checked) {
            border-color: var(--anfal-bright) !important; box-shadow: 0 0 0 1px var(--anfal-bright);
            background: #f4f8ff !important;
          }
          .s4-checkout .payment-option input[type="radio"] { accent-color: var(--anfal-bright); }
          .s4-checkout .payment-option-name { font-weight: 600; color: #1a1a1a; }
          /* Place-order button → Anfal blue */
          .s4-checkout .btn-primary,
          .s4-checkout .btn-block {
            background: var(--anfal-bright) !important; background-image: none !important;
            border: none !important; border-radius: 10px !important;
            font-weight: 700 !important; min-height: 52px; font-size: 1rem; color: #fff !important;
            box-shadow: 0 8px 18px -8px rgba(26,100,232,0.6) !important;
          }
          .s4-checkout .btn-primary:hover { background: #1550c9 !important; }
          /* Order summary */
          .s4-checkout .checkout-summary { position: sticky; top: 20px; }
          .s4-checkout .summary-row { color: #475467; }
          .s4-checkout .summary-row.total {
            color: var(--anfal-blue) !important; font-weight: 800; font-size: 1.2rem;
            padding-top: 0.85rem; border-top: 1px solid #eef0f2; margin-top: 0.4rem;
          }
          .s4-checkout .shipping-option { border-radius: 12px !important; }
          .s4-checkout .shipping-option.active {
            border-color: var(--anfal-bright) !important; box-shadow: 0 0 0 1px var(--anfal-bright);
          }
          .s4-checkout .shipping-option input { accent-color: var(--anfal-bright); }
          .s4-checkout .shipping-option-price { color: var(--anfal-blue) !important; font-weight: 700; }
          /* Coupon */
          .s4-checkout .coupon-input button { background: var(--anfal-blue) !important; border-radius: 8px !important; }
          .s4-checkout .coupon-tag { background: rgba(30,58,138,0.10) !important; color: var(--anfal-blue) !important; }
          /* Guest banner + trust */
          .s4-checkout .guest-banner {
            background: #eff4ff !important; border: 1px solid #d6e0ff !important; border-radius: 12px !important;
          }
          .s4-checkout .guest-banner-link { color: var(--anfal-bright) !important; }
          .s4-checkout .checkout-trust { color: #667085 !important; }
        `}</style>
      )}
      <div className="container">
        {isStore4 ? (
          <div className="s4-co-header">
            <img src="/images/anfal-logo.png" alt="Anfal Sports" className="s4-co-logo" />
            <span className="s4-co-secure"><HiLockClosed /> {t('checkout.secure', 'Secure checkout')}</span>
          </div>
        ) : (
          <h1>Checkout</h1>
        )}

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
            {isStore4 ? (
              <div className="s4-delivery">
                <style>{`
                  .s4-delivery h3 { font-size: 1.55rem; font-weight: 700; margin: 0 0 1.1rem; color: #1a1a1a; }
                  .s4-delivery h3:not(:first-child) { margin-top: 1.6rem; }
                  .s4f-field { position: relative; margin-bottom: 12px; }
                  .s4f-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                  /* scoped under .s4-delivery so these beat layout.css's
                     input[type=...] !important glass rules (higher specificity). */
                  .s4-delivery .s4f-input, .s4-delivery .s4f-select {
                    width: 100%; height: 56px; box-sizing: border-box;
                    padding: 22px 14px 6px; font-size: 16px; line-height: 1.2;
                    border: 1px solid #c9cdd2 !important; border-radius: 8px !important;
                    background: #fff !important; color: #1a1a1a !important;
                    -webkit-appearance: none; appearance: none; font-family: inherit;
                    box-shadow: none !important;
                  }
                  .s4-delivery .s4f-select { padding-right: 38px; cursor: pointer; }
                  .s4-delivery .s4f-input:focus, .s4-delivery .s4f-select:focus {
                    border-color: #1a64e8 !important; box-shadow: 0 0 0 1px #1a64e8 !important; outline: none;
                  }
                  .s4f-label {
                    position: absolute; left: 15px; top: 50%; transform: translateY(-50%);
                    color: #6b7280; font-size: 16px; pointer-events: none;
                    transition: top .12s ease, font-size .12s ease; max-width: calc(100% - 44px);
                    overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
                  }
                  .s4f-input:focus ~ .s4f-label,
                  .s4f-input:not(:placeholder-shown) ~ .s4f-label,
                  .s4f-select ~ .s4f-label { top: 10px; transform: none; font-size: 11px; color: #6b7280; }
                  .s4f-select:required:invalid ~ .s4f-label { top: 50%; transform: translateY(-50%); font-size: 16px; }
                  .s4f-caret { position: absolute; right: 13px; top: 50%; transform: translateY(-50%); pointer-events: none; color: #4b5563; display: flex; }
                  .s4f-help { position: absolute; right: 13px; top: 50%; transform: translateY(-50%); color: #9ca3af; display: flex; cursor: help; }
                  .s4f-save { display: flex; align-items: center; gap: 10px; margin-top: 6px; font-size: 15px; color: #1a1a1a; cursor: pointer; }
                  .s4f-save input { width: 18px; height: 18px; accent-color: #1a64e8; margin: 0; }
                  [dir="rtl"] .s4f-label { left: auto; right: 15px; }
                  [dir="rtl"] .s4f-caret, [dir="rtl"] .s4f-help { right: auto; left: 13px; }
                  [dir="rtl"] .s4f-select { padding-right: 14px; padding-left: 38px; }
                `}</style>

                {isGuest && (
                  <>
                    <h3>{t('checkout.email')}</h3>
                    <S4Field label={t('checkout.email')} name="email" type="email" value={form.email} onChange={handleChange} required help="We'll send your order confirmation here" />
                  </>
                )}

                <h3>{t('checkout.delivery')}</h3>

                <div className="s4f-field">
                  <select className="s4f-select" id="s4-country" defaultValue="Kuwait">
                    <option>Kuwait</option>
                  </select>
                  <label className="s4f-label" htmlFor="s4-country">{t('checkout.countryRegion')}</label>
                  <span className="s4f-caret"><HiChevronDown size={20} /></span>
                </div>

                <div className="s4f-row">
                  <S4Field label={t('checkout.firstName')} optional optionalText={t('checkout.optional')} name="firstName" value={form.firstName} onChange={handleNameChange} />
                  <S4Field label={t('checkout.lastName')} name="lastName" value={form.lastName} onChange={handleNameChange} required />
                </div>

                <S4Field label={t('checkout.address')} name="address" value={form.address} onChange={handleChange} required />
                <S4Field label={t('checkout.apartment')} optional optionalText={t('checkout.optional')} name="apartment" value={form.apartment} onChange={handleChange} />

                <div className="s4f-row">
                  <S4Field label={t('checkout.postalCode')} optional optionalText={t('checkout.optional')} name="zipCode" value={form.zipCode} onChange={handleChange} />
                  <S4Field label={t('checkout.city')} name="city" value={form.city} onChange={handleChange} required />
                </div>

                <div className="s4f-field">
                  <select className="s4f-select" id="s4-gov" name="state" value={form.state} onChange={handleChange} required>
                    <option value="" disabled hidden></option>
                    {KUWAIT_GOVERNORATES.map((g) => (<option key={g} value={g}>{g}</option>))}
                  </select>
                  <label className="s4f-label" htmlFor="s4-gov">{t('checkout.governorate')}</label>
                  <span className="s4f-caret"><HiChevronDown size={20} /></span>
                </div>

                <S4Field label={t('checkout.phone')} name="phone" type="tel" value={form.phone} onChange={handleChange} required help="In case we need to contact you about your order" />

                <label className="s4f-save">
                  <input type="checkbox" checked={saveInfo} onChange={(e) => setSaveInfo(e.target.checked)} />
                  {t('checkout.saveInfo')}
                </label>
              </div>
            ) : (
              <>
                {isGuest && (
                  <>
                    <h3>{t('checkout.email')}</h3>
                    <div className="form-group">
                      <label>{t('checkout.email')}</label>
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

                <h3>{t('checkout.shippingAddress')}</h3>
                <div className="form-group">
                  <label>{t('checkout.fullName')}</label>
                  <input name="fullName" value={form.fullName} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>{t('checkout.address')}</label>
                  <input name="address" value={form.address} onChange={handleChange} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('checkout.city')}</label>
                    <input name="city" value={form.city} onChange={handleChange} required />
                  </div>
                  <div className="form-group form-group-state">
                    <label className="label-state">{isStore2 ? 'Emirate' : t('checkout.state')}</label>
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
                    <label>{isStore3 ? 'Pincode' : t('checkout.zipCode')}</label>
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
                  <label>{t('checkout.phone')}</label>
                  <input name="phone" value={form.phone} onChange={handleChange} required />
                </div>
              </>
            )}
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
                ? t('checkout.placingOrder')
                : isOnlinePayment
                  ? `${t('checkout.placeOrder')} — ${cur}${formatPrice(grandTotal)}`
                  : t('checkout.placeOrder')
              }
            </button>
          </div>

          {/* Section 3: Order Summary */}
          <div className="order-summary checkout-summary">
            <h3>{t('checkout.orderSummary')}</h3>
            {cart.map((item) => (
              <div key={item.cartKey} className="summary-item">
                <span>
                  {item.name}
                  {item.selectedVariant && ` (${Object.values(item.selectedVariant).join(', ')})`}
                  {' x '}{item.quantity}
                </span>
                <span>{cur}{formatPrice(parseFloat(item.price) * item.quantity)}</span>
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
                          ? `${c.value}% off${c.maxDiscount ? ` (up to ${cur}${c.maxDiscount})` : ''}`
                          : `${cur}${c.value} off`;
                        const eligible = cartTotal >= c.minOrderAmount;
                        return (
                          <li key={c.code} className={`coupon-list-item ${!eligible ? 'is-locked' : ''}`}>
                            <div className="coupon-list-info">
                              <span className="coupon-tag">{c.code}</span>
                              <span className="coupon-list-value">{valueLabel}</span>
                              {c.description && <p className="coupon-list-desc">{c.description}</p>}
                              {c.minOrderAmount > 0 && (
                                <p className="coupon-list-meta">
                                  Min. order {cur}{formatPrice(c.minOrderAmount)}
                                  {!eligible && ` · add ${cur}${formatPrice(c.minOrderAmount - cartTotal)} more`}
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
              <span>{t('cart.subtotal')}</span>
              <span>{cur}{formatPrice(cartTotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="summary-row discount-row">
                <span>{t('cart.discount')}</span>
                <span>-{cur}{formatPrice(discountAmount)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="summary-row" style={{ color: 'var(--text-light)', fontSize: '0.82rem' }}>
                <span>
                  Incl. GST
                  {taxInfo.breakdown && (
                    <span style={{ fontSize: '0.72rem', display: 'block', marginTop: '2px' }}>
                      {taxInfo.breakdown.isSameState
                        ? `CGST ${cur}${formatPrice(taxInfo.breakdown.cgst)} + SGST ${cur}${formatPrice(taxInfo.breakdown.sgst)}`
                        : `IGST ${cur}${formatPrice(taxInfo.breakdown.igst)}`
                      }
                    </span>
                  )}
                </span>
                <span>{cur}{formatPrice(taxAmount)}</span>
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
                    <span className="shipping-option-name">{t('checkout.shippingStandard')}</span>
                    <span className="shipping-option-days">{shipDays(shippingOptions.standard)}</span>
                  </div>
                  <span className="shipping-option-price">
                    {shippingOptions.standard.rate === 0 ? t('checkout.free') : `${cur}${formatPrice(shippingOptions.standard.rate)}`}
                  </span>
                </label>
                <label
                  className={`shipping-option ${shippingMethod === 'express' ? 'active' : ''}`}
                  onClick={() => setShippingMethod('express')}
                >
                  <input type="radio" name="shipping" checked={shippingMethod === 'express'} readOnly />
                  <div className="shipping-option-info">
                    <span className="shipping-option-name">{t('checkout.shippingExpress')}</span>
                    <span className="shipping-option-days">{shipDays(shippingOptions.express)}</span>
                  </div>
                  <span className="shipping-option-price">{cur}{formatPrice(shippingOptions.express.rate)}</span>
                </label>
                {shippingOptions.amountForFree && (
                  <p className="shipping-free-hint">
                    {`Add ${cur}${formatPrice(shippingOptions.amountForFree)} more for free shipping`}
                  </p>
                )}
              </div>
            )}
            <div className="summary-row total">
              <span>{t('cart.total')}</span>
              <span>{cur}{formatPrice(grandTotal)}</span>
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
