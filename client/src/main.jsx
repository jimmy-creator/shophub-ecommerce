import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Initialise i18next + RTL handling for stores that opt in.
// Side-effect import: setting up i18next here means useTranslation()
// works anywhere in the tree without a Suspense fallback. Render is
// deferred until i18n finishes loading so first paint isn't keys.
function render() {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

if (import.meta.env.VITE_FEATURE_I18N === 'true') {
  import('./i18n').then(render).catch((err) => {
    console.error('[i18n] failed to load, rendering anyway:', err);
    render();
  });
} else {
  render();
}
