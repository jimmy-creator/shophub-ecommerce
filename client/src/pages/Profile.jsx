import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HiHeart, HiShoppingCart, HiLogout, HiCog } from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, logout } = useAuth();
  const { wishlistCount } = useWishlist();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.put('/auth/profile', form);
      localStorage.setItem('user', JSON.stringify(data));
      toast.success('Profile updated!');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="container">
        {/* Quick Links */}
        <div className="profile-links">
          <Link to="/orders" className="profile-link-card">
            <HiShoppingCart />
            <span>My Orders</span>
          </Link>
          <Link to="/wishlist" className="profile-link-card">
            <HiHeart />
            <span>Wishlist{wishlistCount > 0 ? ` (${wishlistCount})` : ''}</span>
          </Link>
          {(user?.role === 'admin' || user?.role === 'staff') && (
            <Link to="/admin" className="profile-link-card">
              <HiCog />
              <span>Admin Panel</span>
            </Link>
          )}
          <button className="profile-link-card" onClick={logout}>
            <HiLogout />
            <span>Logout</span>
          </button>
        </div>

        <div className="auth-card">
          <h2>My Profile</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input value={user?.email || ''} disabled />
            </div>
            <div className="form-group">
              <label>Full Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Address</label>
              <textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={3}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
