import { useState, useEffect, useCallback } from 'react';

// POS-only light/dark theme. Independent of the storefront ThemeContext — the
// register is a separate full-screen surface. Persisted per device so a cashier
// keeps their preference across shifts. Default: dark (the original POS look).
const KEY = 'pos-theme';

export function usePosTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; }
    catch { return 'dark'; }
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  return { theme, toggleTheme };
}
