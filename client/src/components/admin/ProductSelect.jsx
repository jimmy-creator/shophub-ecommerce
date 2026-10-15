/**
 * Searchable product dropdown — drop-in for a plain <select> of products.
 * Type to filter by name or code; click a result to pick it.
 */
import { useState, useEffect, useRef } from 'react';

const MAX_RESULTS = 50;

export default function ProductSelect({ products, value, onChange, placeholder = 'Search product…', required, style }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const selected = products.find((p) => p.id === Number(value));

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const matches = (q
    ? products.filter((p) => p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q))
    : products
  ).slice(0, MAX_RESULTS);

  const pick = (p) => {
    onChange(p.id);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={boxRef} style={{ position: 'relative', ...style }}>
      <input
        type="text"
        value={open ? query : (selected?.name || '')}
        placeholder={selected && open ? selected.name : placeholder}
        onFocus={() => { setQuery(''); setOpen(true); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); if (matches[0]) pick(matches[0]); }
          if (e.key === 'Escape') setOpen(false);
        }}
        required={required && !selected}
        style={{ width: '100%', padding: '0.4rem 0.5rem', border: '1px solid var(--border)', borderRadius: 4, boxSizing: 'border-box' }}
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 2,
          maxHeight: 260, overflowY: 'auto', background: 'var(--bg-card, #fff)',
          border: '1px solid var(--border)', borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        }}>
          {matches.length === 0 && (
            <div style={{ padding: '0.5rem 0.6rem', fontSize: '0.85rem', color: 'var(--text-light)' }}>
              {products.length === 0 ? 'Loading products…' : 'No products found'}
            </div>
          )}
          {matches.map((p) => (
            <div
              key={p.id}
              onMouseDown={(e) => { e.preventDefault(); pick(p); }}
              style={{
                padding: '0.45rem 0.6rem', cursor: 'pointer', fontSize: '0.88rem',
                background: p.id === selected?.id ? 'var(--bg-warm)' : 'transparent',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-warm)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = p.id === selected?.id ? 'var(--bg-warm)' : 'transparent'; }}
            >
              {p.name}
              {p.code && <span style={{ marginLeft: 6, fontSize: '0.75rem', color: 'var(--text-light)' }}>{p.code}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
