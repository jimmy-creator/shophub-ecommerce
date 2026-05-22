import sharedThemes from '../../themes/shared';

export const defaultTheme = 'marketplace';

const store3Themes = {
  ...sharedThemes,

  blanc: {
    name: 'Blanc',
    description: 'Pure white with warm gold accents',
    vars: {
      '--font-display': "'Instrument Serif', Georgia, serif",
      '--font-body':    "'Manrope', system-ui, sans-serif",
      '--copper':       '#b08754',
      '--copper-light': '#c9a47a',
      '--copper-dark':  '#8a6638',
      '--gold':         '#c9a04a',
      '--bg':           '#ffffff',
      '--bg-warm':      '#ffffff',
      '--bg-card':      'rgba(255, 255, 255, 0.85)',
      '--bg-dark':      '#171311',
      '--bg-dark-warm': '#241d18',
      '--text':         '#171311',
      '--text-secondary': '#5a5048',
      '--text-light':   '#a39b91',
      '--text-inverse': '#ffffff',
      '--border':       'rgba(23, 19, 17, 0.08)',
      '--border-light': 'rgba(23, 19, 17, 0.04)',
      '--success':      '#3B277E',
      '--danger':       '#e11d48',
      '--shadow-sm':    '0 2px 8px rgba(23, 19, 17, 0.05)',
      '--shadow':       '0 4px 16px rgba(23, 19, 17, 0.07)',
      '--shadow-md':    '0 12px 32px rgba(23, 19, 17, 0.09)',
      '--shadow-lg':    '0 24px 60px rgba(23, 19, 17, 0.12)',
      '--radius':       '16px',
      '--radius-lg':    '24px',
    },
    font: 'Instrument+Serif:ital@0;1&family=Manrope:wght@300;400;500;600;700',
  },
};

export default store3Themes;
