import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export default function ScrollToTopButton({ threshold = 320 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="s2-scroll-top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Scroll to top"
    >
      <ArrowUp size={20} strokeWidth={2.2} />
    </button>
  );
}
