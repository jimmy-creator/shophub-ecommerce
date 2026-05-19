import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import { localizedName } from '../../utils/i18nHelpers';

const B2B_ENABLED = import.meta.env.VITE_FEATURE_B2B === 'true';

export default function Footer() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.get('/categories').then(res => setCategories(res.data.slice(0, 5))).catch(() => {});
  }, []);

  return (
    <footer className="s2-footer">
      <div className="s2-footer-grid">
        <div>
          <img src="/images/anfal-logo.png" alt="Anfal Sports" className="s2-footer-logo-img" />
          <p className="s2-footer-brand-tag">{t('home.seoDescription')}</p>
        </div>
        <div className="s2-footer-col">
          <h4>{t('footer.shop')}</h4>
          <Link to="/products">{t('products.allProducts')}</Link>
          {categories.map(cat => (
            <Link key={cat.id} to={`/products?category=${encodeURIComponent(cat.name)}`}>{localizedName(cat)}</Link>
          ))}
        </div>
        <div className="s2-footer-col">
          <h4>{t('common.account')}</h4>
          <Link to="/cart">{t('common.cart')}</Link>
          <Link to="/orders">{t('common.products')}</Link>
          <Link to="/profile">{t('common.profile')}</Link>
          <Link to="/wishlist">{t('common.wishlist')}</Link>
        </div>
        <div className="s2-footer-col">
          <h4>{t('footer.company')}</h4>
          <Link to="/about">{t('footer.aboutUs')}</Link>
          <Link to="/contact">{t('footer.contactUs')}</Link>
          {B2B_ENABLED && <Link to="/wholesale">Wholesale</Link>}
          <Link to="/privacy-policy">{t('footer.privacyPolicy')}</Link>
          <Link to="/terms">{t('footer.terms')}</Link>
        </div>
        <div className="s2-footer-col">
          <h4>{t('footer.support')}</h4>
          <Link to="/shipping-policy">{t('footer.shippingPolicy')}</Link>
          <Link to="/refund-policy">{t('footer.refundPolicy')}</Link>
          <Link to="/return-policy">{t('footer.returnPolicy')}</Link>
        </div>
      </div>
      <div className="s2-footer-bottom">
        <span>{t('footer.copyright', { year: new Date().getFullYear(), store: 'Anfal Sports' })}</span>
      </div>
    </footer>
  );
}
