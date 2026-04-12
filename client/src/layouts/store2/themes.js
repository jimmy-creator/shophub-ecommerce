import sharedThemes from '../../themes/shared';

export const defaultTheme = 'aurora';

const store2Themes = {
  ...sharedThemes,

  aurora: {
    name: 'Aurora Atrium',
    description: 'Light frosted glass with soft blue aurora',
    vars: {
      '--font-display': "'Instrument Serif', Georgia, serif",
      '--font-body':    "'Manrope', system-ui, sans-serif",
      '--copper':       '#0ea5e9',
      '--copper-light': '#38bdf8',
      '--copper-dark':  '#0369a1',
      '--gold':         '#06b6d4',
      '--bg':           '#f8fafc',
      '--bg-warm':      '#f1f5f9',
      '--bg-card':      'rgba(255, 255, 255, 0.6)',
      '--bg-dark':      '#0f172a',
      '--bg-dark-warm': '#1e293b',
      '--text':         '#0f172a',
      '--text-secondary': '#475569',
      '--text-light':   '#94a3b8',
      '--text-inverse': '#ffffff',
      '--border':       'rgba(0, 20, 60, 0.08)',
      '--border-light': 'rgba(0, 20, 60, 0.04)',
      '--success':      '#16a34a',
      '--danger':       '#e11d48',
      '--shadow-sm':    '0 2px 8px rgba(0, 20, 60, 0.06)',
      '--shadow':       '0 4px 16px rgba(0, 20, 60, 0.08)',
      '--shadow-md':    '0 12px 32px rgba(0, 20, 60, 0.1)',
      '--shadow-lg':    '0 24px 60px rgba(0, 20, 60, 0.14)',
      '--radius':       '16px',
      '--radius-lg':    '24px',
    },
    font: 'Instrument+Serif:ital@0;1&family=Manrope:wght@300;400;500;600;700',
  },

  prism: {
    name: 'Prism Glass',
    description: 'Pastel aurora on pale ice',
    vars: {
      '--font-display': "'Instrument Serif', Georgia, serif",
      '--font-body':    "'Manrope', system-ui, sans-serif",
      '--copper':       '#7c3aed',
      '--copper-light': '#a78bfa',
      '--copper-dark':  '#5b21b6',
      '--gold':         '#0891b2',
      '--bg':           '#f5f3ff',
      '--bg-warm':      '#ede9fe',
      '--bg-card':      'rgba(255, 255, 255, 0.65)',
      '--bg-dark':      '#1e1b4b',
      '--bg-dark-warm': '#312e81',
      '--text':         '#1e1b4b',
      '--text-secondary': '#4c4a6b',
      '--text-light':   '#8b89a8',
      '--text-inverse': '#ffffff',
      '--border':       'rgba(30, 27, 75, 0.12)',
      '--border-light': 'rgba(30, 27, 75, 0.06)',
      '--success':      '#059669',
      '--danger':       '#e11d48',
      '--radius':       '16px',
    },
    font: 'Instrument+Serif:ital@0;1&family=Manrope:wght@300;400;500;600;700',
  },
};

export default store2Themes;
