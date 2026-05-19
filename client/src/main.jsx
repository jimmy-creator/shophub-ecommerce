import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Initialise i18next + RTL handling for stores that opt in.
// Side-effect import: setting up i18next here means useTranslation()
// works anywhere in the tree without a Suspense fallback.
if (import.meta.env.VITE_FEATURE_I18N === 'true') {
  await import('./i18n');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
