import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { ThemeProvider } from './context/ThemeContext';
import { RecentlyViewedProvider } from './context/RecentlyViewedContext';
import { Home, Navbar, Footer, Products, ProductDetail, ContactUs } from '@layout';
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
import ReturnPolicy from './pages/ReturnPolicy';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function PageWrapper({ children }) {
  const { pathname } = useLocation();
  return <div key={pathname} className="page-transition">{children}</div>;
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
                <Route path="/" element={<Home />} />
                <Route path="/products" element={<Products />} />
                <Route path="/product/:slug" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/login" element={<Login />} />
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
