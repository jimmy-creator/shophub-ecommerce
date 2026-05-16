import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SEO from '../../components/SEO';

export default function StaticPage({ title, description, children }) {
  return (
    <div className="s2-root">
      <SEO title={title} description={description} />
      <div className="s2-static-page">
        <Link to="/" className="s2-back">
          <ArrowLeft size={14} strokeWidth={1.8} /> Back to home
        </Link>
        <div className="s2-static-header">
          <p className="s2-eyebrow">Zayara Mobile Phones LLC</p>
          <h1 className="s2-static-title">{title}</h1>
        </div>
        <div className="s2-static-body">
          {children}
        </div>
      </div>
    </div>
  );
}
