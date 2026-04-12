import { Helmet } from 'react-helmet-async';
import { CURRENCY } from '../utils/currency';

const SITE_NAME = 'ShopHub';
const DEFAULT_DESC = `Shop the latest products at great prices. Free shipping on orders over ${CURRENCY}500.`;
const SITE_URL = typeof window !== 'undefined' ? window.location.origin : '';

export default function SEO({
  title,
  description = DEFAULT_DESC,
  image,
  url,
  type = 'website',
  product,
}) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const pageUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const ogImage = image || `${SITE_URL}/images/hero-banner.jpeg`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Product specific */}
      {product && (
        <>
          <meta property="product:price:amount" content={product.price} />
          <meta property="product:price:currency" content="INR" />
          {product.stock > 0 ? (
            <meta property="product:availability" content="in stock" />
          ) : (
            <meta property="product:availability" content="out of stock" />
          )}
        </>
      )}

      <link rel="canonical" href={pageUrl} />
    </Helmet>
  );
}
