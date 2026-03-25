import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

const themes = {
  default: {
    name: 'Warm Luxury',
    description: 'Copper & cream editorial',
    vars: {}, // Uses the base CSS — no overrides needed
  },
  midnight: {
    name: 'Midnight Dark',
    description: 'Elegant dark mode',
    vars: {
      '--font-display': "'Playfair Display', Georgia, serif",
      '--copper': '#a78bfa',
      '--copper-light': '#c4b5fd',
      '--copper-dark': '#7c3aed',
      '--gold': '#a78bfa',
      '--bg': '#0f0f14',
      '--bg-warm': '#16161d',
      '--bg-card': '#1c1c26',
      '--bg-dark': '#ffffff',
      '--bg-dark-warm': '#f0f0f5',
      '--text': '#e4e4ec',
      '--text-secondary': '#9494a8',
      '--text-light': '#5c5c72',
      '--text-inverse': '#0f0f14',
      '--border': '#2a2a3a',
      '--border-light': '#22222e',
      '--success': '#6ee7a0',
      '--danger': '#f87171',
    },
    font: 'Playfair+Display:wght@400;500;600;700',
  },
  minimal: {
    name: 'Clean Minimal',
    description: 'Black & white simplicity',
    vars: {
      '--font-display': "'DM Sans', sans-serif",
      '--font-body': "'DM Sans', sans-serif",
      '--copper': '#000000',
      '--copper-light': '#333333',
      '--copper-dark': '#000000',
      '--gold': '#000000',
      '--bg': '#ffffff',
      '--bg-warm': '#f5f5f5',
      '--bg-card': '#ffffff',
      '--bg-dark': '#000000',
      '--bg-dark-warm': '#111111',
      '--text': '#111111',
      '--text-secondary': '#666666',
      '--text-light': '#999999',
      '--text-inverse': '#ffffff',
      '--border': '#e0e0e0',
      '--border-light': '#eeeeee',
      '--success': '#22c55e',
      '--danger': '#ef4444',
    },
    font: 'DM+Sans:wght@300;400;500;600;700',
  },
  forest: {
    name: 'Forest Green',
    description: 'Natural & earthy tones',
    vars: {
      '--font-display': "'Libre Baskerville', Georgia, serif",
      '--copper': '#2d6a4f',
      '--copper-light': '#40916c',
      '--copper-dark': '#1b4332',
      '--gold': '#b7791f',
      '--bg': '#fefdf8',
      '--bg-warm': '#f5f1e8',
      '--bg-card': '#ffffff',
      '--bg-dark': '#1b4332',
      '--bg-dark-warm': '#2d6a4f',
      '--text': '#1a1a1a',
      '--text-secondary': '#5c6b5e',
      '--text-light': '#8a9a8c',
      '--text-inverse': '#fefdf8',
      '--border': '#d4cdb8',
      '--border-light': '#e8e2d0',
      '--success': '#2d6a4f',
      '--danger': '#c94040',
    },
    font: 'Libre+Baskerville:wght@400;700',
  },
  royal: {
    name: 'Royal Blue',
    description: 'Bold & premium',
    vars: {
      '--font-display': "'Fraunces', Georgia, serif",
      '--copper': '#1e40af',
      '--copper-light': '#3b82f6',
      '--copper-dark': '#1e3a8a',
      '--gold': '#f59e0b',
      '--bg': '#f8faff',
      '--bg-warm': '#eef2ff',
      '--bg-card': '#ffffff',
      '--bg-dark': '#0f172a',
      '--bg-dark-warm': '#1e293b',
      '--text': '#0f172a',
      '--text-secondary': '#475569',
      '--text-light': '#94a3b8',
      '--text-inverse': '#f8faff',
      '--border': '#cbd5e1',
      '--border-light': '#e2e8f0',
      '--success': '#059669',
      '--danger': '#dc2626',
    },
    font: 'Fraunces:wght@400;500;600;700',
  },
};

export const themeList = Object.entries(themes).map(([id, t]) => ({
  id, name: t.name, description: t.description,
}));

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('store-theme') || 'default';
  });

  // Fetch store theme setting on mount
  useEffect(() => {
    api.get('/settings/theme').then((res) => {
      if (res.data.theme && themes[res.data.theme]) {
        setCurrentTheme(res.data.theme);
        localStorage.setItem('store-theme', res.data.theme);
      }
    }).catch(() => {});
  }, []);

  // Apply theme CSS variables
  useEffect(() => {
    const theme = themes[currentTheme];
    if (!theme) return;

    const root = document.documentElement;

    // Reset to defaults first (remove previous theme vars)
    Object.keys(themes.midnight.vars).forEach((key) => {
      root.style.removeProperty(key);
    });

    // Apply new theme vars
    Object.entries(theme.vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Load theme font if needed
    if (theme.font) {
      const fontId = `theme-font-${currentTheme}`;
      if (!document.getElementById(fontId)) {
        const link = document.createElement('link');
        link.id = fontId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${theme.font}&display=swap`;
        document.head.appendChild(link);
      }
    }
  }, [currentTheme]);

  const changeTheme = async (themeId) => {
    if (!themes[themeId]) return;
    setCurrentTheme(themeId);
    localStorage.setItem('store-theme', themeId);
    // Persist to server (admin only)
    try {
      await api.put('/settings/theme', { theme: themeId });
    } catch (e) {}
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, changeTheme, themes: themeList }}>
      {children}
    </ThemeContext.Provider>
  );
}
