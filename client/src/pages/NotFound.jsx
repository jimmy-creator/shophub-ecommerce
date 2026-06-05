import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { HiOutlineExclamationCircle } from 'react-icons/hi';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="empty-state">
      <Helmet>
        <title>{t('notFound.title', 'Page not found')}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <HiOutlineExclamationCircle className="empty-icon" />
      <h1 style={{ fontSize: '2.5rem', margin: '0 0 0.25rem' }}>404</h1>
      <h2>{t('notFound.title', 'Page not found')}</h2>
      <p>{t('notFound.message', "The page you're looking for doesn't exist or has moved.")}</p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link to="/" className="btn btn-primary">{t('notFound.home', 'Back to home')}</Link>
        <Link to="/products" className="btn btn-secondary">{t('notFound.shop', 'Browse products')}</Link>
      </div>
    </div>
  );
}
