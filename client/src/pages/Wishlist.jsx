import { Link } from 'react-router-dom';
import { HiHeart, HiShoppingCart, HiTrash } from 'react-icons/hi';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import ProductImage from '../components/ProductImage';
import { showToast } from '../utils/toast';

export default function Wishlist() {
  const { wishlist, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();

  if (wishlist.length === 0) {
    return (
      <div className="empty-state">
        <HiHeart className="empty-icon" />
        <h2>Your wishlist is empty</h2>
        <p>Save items you love for later!</p>
        <Link to="/products" className="btn btn-primary">Browse Products</Link>
      </div>
    );
  }

  const handleAddToCart = (item) => {
    const hasVariants = item.variants && item.variants.length > 0;
    if (hasVariants) {
      window.location.href = `/product/${item.slug}`;
      return;
    }
    addToCart(item);
    showToast('Added to cart');
  };

  return (
    <div className="wishlist-page">
      <div className="container">
        <h1>My Wishlist ({wishlist.length})</h1>
        <div className="wishlist-grid">
          {wishlist.map((item) => (
            <div key={item.id} className="wishlist-item">
              <Link to={`/product/${item.slug}`} className="wishlist-item-image">
                <ProductImage product={item} size="normal" />
              </Link>
              <div className="wishlist-item-info">
                <Link to={`/product/${item.slug}`}>
                  <h3>{item.name}</h3>
                </Link>
                <span className="product-category">{item.category}</span>
                <div className="product-pricing">
                  <span className="price">₹{parseFloat(item.price).toFixed(2)}</span>
                  {item.comparePrice && (
                    <span className="compare-price">₹{parseFloat(item.comparePrice).toFixed(2)}</span>
                  )}
                </div>
                <div className="wishlist-item-actions">
                  <button className="btn btn-primary" onClick={() => handleAddToCart(item)}>
                    <HiShoppingCart /> {item.variants?.length > 0 ? 'Select Options' : 'Add to Cart'}
                  </button>
                  <button className="wishlist-remove-btn" onClick={() => {
                    removeFromWishlist(item.id);
                    showToast('Removed from wishlist');
                  }}>
                    <HiTrash />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
