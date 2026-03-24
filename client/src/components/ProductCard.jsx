import { Link } from 'react-router-dom';
import { HiShoppingCart, HiStar } from 'react-icons/hi';
import { useCart } from '../context/CartContext';
import ProductImage from './ProductImage';
import toast from 'react-hot-toast';

export default function ProductCard({ product }) {
  const { addToCart } = useCart();

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
    toast.success(`Added to cart`, {
      style: {
        background: '#1a1614',
        color: '#f5f0eb',
        fontSize: '0.88rem',
        fontFamily: "'Outfit', sans-serif",
        borderRadius: '4px',
      },
      iconTheme: { primary: '#c4784a', secondary: '#f5f0eb' },
    });
  };

  const discount = product.comparePrice
    ? Math.round((1 - product.price / product.comparePrice) * 100)
    : 0;

  return (
    <Link to={`/product/${product.slug}`} className="product-card">
      <div className="product-image">
        <ProductImage product={product} />
        {discount > 0 && <span className="discount-badge">-{discount}%</span>}
      </div>
      <div className="product-info">
        <span className="product-category">{product.category}</span>
        <h3 className="product-name">{product.name}</h3>
        <div className="product-rating">
          <HiStar className="star" />
          <span>{product.ratings || '0.0'}</span>
          <span className="review-count">({product.numReviews})</span>
        </div>
        <div className="product-pricing">
          <span className="price">₹{parseFloat(product.price).toFixed(2)}</span>
          {product.comparePrice && (
            <span className="compare-price">
              ₹{parseFloat(product.comparePrice).toFixed(2)}
            </span>
          )}
        </div>
        <button className="add-to-cart-btn" onClick={handleAdd}>
          <HiShoppingCart /> Add to Cart
        </button>
      </div>
    </Link>
  );
}
