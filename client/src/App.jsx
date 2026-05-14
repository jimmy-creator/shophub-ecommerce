import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { ThemeProvider } from './context/ThemeContext';
import { RecentlyViewedProvider } from './context/RecentlyViewedContext';
import { Home, Navbar, Footer, Products, ProductDetail, ContactUs, AboutUs, PrivacyPolicy, RefundPolicy, ReturnPolicy, ShippingPolicy, TermsOfService } from '@layout';
import Wishlist from './pages/Wishlist';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Login from './pages/Login';
import Register from './pages/Register';
import Orders from './pages/Orders';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import OrderSuccess from './pages/OrderSuccess';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ShippingInfo from './pages/ShippingInfo';
import Wholesale from './pages/Wholesale';
import WholesaleRequest from './pages/WholesaleRequest';
import WholesaleQuotes from './pages/WholesaleQuotes';
import WholesaleQuoteDetail from './pages/WholesaleQuoteDetail';

const B2B_ENABLED = import.meta.env.VITE_FEATURE_B2B === 'true';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function PageWrapper({ children }) {
  const { pathname } = useLocation();
  return <div key={pathname} className="page-transition">{children}</div>;
}

let didInitialStaffRedirect = false;

function StaffGate({ children }) {
  const { user } = useAuth();
  const isStaff = user && (user.role === 'admin' || user.role === 'staff');
  if (isStaff && !didInitialStaffRedirect) {
    didInitialStaffRedirect = true;
    return <Navigate to="/admin" replace />;
  }
  return children;
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function App() {
  const app = (
    <HelmetProvider>
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <CartProvider>
        <WishlistProvider>
        <RecentlyViewedProvider>
        <ThemeProvider>
          <Toaster position="top-right" />
          <div className="app">
            <Navbar />
            <main className="main">
              <PageWrapper>
              <Routes>
                <Route path="/" element={<StaffGate><Home /></StaffGate>} />
                <Route path="/products" element={<Products />} />
                <Route path="/product/:slug" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/login" element={<StaffGate><Login /></StaffGate>} />
                <Route path="/register" element={<Register />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/order-success" element={<OrderSuccess />} />
                <Route path="/wishlist" element={<Wishlist />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/contact" element={<ContactUs />} />
                <Route path="/shipping-info" element={<ShippingInfo />} />
                <Route path="/return-policy" element={<ReturnPolicy />} />
                <Route path="/about" element={<AboutUs />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/refund-policy" element={<RefundPolicy />} />
                <Route path="/shipping-policy" element={<ShippingPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                {B2B_ENABLED && <Route path="/wholesale" element={<Wholesale />} />}
                {B2B_ENABLED && <Route path="/wholesale/request" element={<WholesaleRequest />} />}
                {B2B_ENABLED && <Route path="/wholesale/my-quotes" element={<WholesaleQuotes />} />}
                {B2B_ENABLED && <Route path="/wholesale/my-quotes/:id" element={<WholesaleQuoteDetail />} />}
              </Routes>
              </PageWrapper>
            </main>
            <Footer />
          </div>
        </ThemeProvider>
        </RecentlyViewedProvider>
        </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
    </HelmetProvider>
  );

  if (googleClientId) {
    return <GoogleOAuthProvider clientId={googleClientId}>{app}</GoogleOAuthProvider>;
  }
  return app;
}
