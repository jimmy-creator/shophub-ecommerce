import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function AnnouncementBar() {
  const [items, setItems] = useState(() => {
    const cached = localStorage.getItem('cached-announcements');
    return cached ? JSON.parse(cached) : [];
  });

  useEffect(() => {
    api.get('/settings/announcements')
      .then((res) => {
        if (Array.isArray(res.data)) {
          setItems(res.data);
          localStorage.setItem('cached-announcements', JSON.stringify(res.data));
        }
      })
      .catch(() => {});
  }, []);

  if (!items.length) return null;

  // Duplicate the list so the marquee animation has a seamless loop.
  const loop = [...items, ...items];

  return (
    <div className="s2-announcement-bar" role="region" aria-label="Announcements">
      <div className="s2-announcement-track">
        {loop.map((text, i) => (
          <span key={i} className="s2-announcement-item">
            <span className="s2-announcement-text">{text}</span>
            <span className="s2-announcement-sep" aria-hidden="true">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}
