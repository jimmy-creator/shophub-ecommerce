import toast from 'react-hot-toast';

export function showToast(message, type = 'success') {
  // Read current theme from body class or localStorage
  const isMarketplace = document.body.classList.contains('theme-marketplace');

  if (isMarketplace) {
    toast[type](message, {
      style: {
        background: '#fff',
        color: '#1a1a2e',
        fontSize: '0.88rem',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        borderRadius: '14px',
        padding: '12px 20px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        border: '1px solid #f3f4f6',
      },
      iconTheme: {
        primary: type === 'error' ? '#ef4444' : '#2563eb',
        secondary: '#fff',
      },
    });
  } else {
    toast[type](message, {
      style: {
        background: '#1a1614',
        color: '#f5f0eb',
        fontSize: '0.88rem',
        fontFamily: "'Outfit', sans-serif",
        borderRadius: '4px',
      },
      iconTheme: { primary: '#c4784a', secondary: '#f5f0eb' },
    });
  }
}
