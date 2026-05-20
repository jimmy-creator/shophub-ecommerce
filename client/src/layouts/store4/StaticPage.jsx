import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';

export default function StaticPage({ title, titleAr, description, descriptionAr, children }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const displayTitle = isAr && titleAr ? titleAr : title;
  const displayDesc = isAr && descriptionAr ? descriptionAr : description;
  const homePath = isAr ? '/ar' : '/';
  const BackIcon = isAr ? ArrowRight : ArrowLeft;
  return (
    <div className="s2-root">
      <SEO title={displayTitle} description={displayDesc} />
      <div className="s2-static-page">
        <Link to={homePath} className="s2-back">
          <BackIcon size={14} strokeWidth={1.8} /> {isAr ? 'العودة إلى الرئيسية' : 'Back to home'}
        </Link>
        <div className="s2-static-header">
          <p className="s2-eyebrow">{isAr ? 'أنفال سبورتس ذ.م.م' : 'Anfal Sports W.L.L.'}</p>
          <h1 className="s2-static-title">{displayTitle}</h1>
        </div>
        <div className="s2-static-body">
          {children}
        </div>
      </div>
    </div>
  );
}
