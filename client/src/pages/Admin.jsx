import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { HiPlus, HiPencil, HiTrash, HiPhotograph, HiX, HiEye, HiEyeOff } from 'react-icons/hi';
import ProductImage from '../components/ProductImage';
import { useTheme } from '../context/ThemeContext';
import { CURRENCY } from '../utils/currency';

const emptyProduct = {
  name: '', description: '', price: '', comparePrice: '',
  category: '', brand: '', stock: '', featured: false, images: [],
  variantOptions: null, variants: null,
};

function VariantEditor({ variantOptions, variants, onChange, basePrice }) {
  const [enabled, setEnabled] = useState(!!variantOptions && Object.keys(variantOptions || {}).length > 0);
  const [types, setTypes] = useState(() => {
    if (!variantOptions) return [];
    return Object.entries(variantOptions).map(([name, values]) => ({
      name,
      values: values.join(', '),
    }));
  });
  const [variantList, setVariantList] = useState(variants || []);

  const generateCombinations = (typesArr) => {
    const opts = typesArr
      .filter((t) => t.name.trim() && t.values.trim())
      .map((t) => ({
        name: t.name.trim(),
        values: t.values.split(',').map((v) => v.trim()).filter(Boolean),
      }));

    if (opts.length === 0) return { options: {}, combos: [] };

    const options = {};
    opts.forEach((o) => { options[o.name] = o.values; });

    // Generate all combinations
    const combos = opts.reduce((acc, opt) => {
      if (acc.length === 0) {
        return opt.values.map((v) => ({ [opt.name]: v }));
      }
      const result = [];
      acc.forEach((existing) => {
        opt.values.forEach((v) => {
          result.push({ ...existing, [opt.name]: v });
        });
      });
      return result;
    }, []);

    // Merge with existing variant data (preserve sku/price/stock)
    const merged = combos.map((combo) => {
      const key = JSON.stringify(combo);
      const existing = variantList.find((v) => JSON.stringify(v.options) === key);
      return {
        options: combo,
        sku: existing?.sku || '',
        price: existing?.price ?? basePrice ?? '',
        stock: existing?.stock ?? 0,
      };
    });

    return { options, combos: merged };
  };

  const handleToggle = (val) => {
    setEnabled(val);
    if (!val) {
      onChange(null, null);
      setTypes([]);
      setVariantList([]);
    } else {
      setTypes([{ name: 'Size', values: 'S, M, L, XL' }]);
    }
  };

  const handleTypesChange = (newTypes) => {
    setTypes(newTypes);
    const { options, combos } = generateCombinations(newTypes);
    setVariantList(combos);
    onChange(Object.keys(options).length > 0 ? options : null, combos.length > 0 ? combos : null);
  };

  const handleVariantFieldChange = (index, field, value) => {
    const updated = [...variantList];
    if (field === 'price') {
      updated[index][field] = value === '' ? null : parseFloat(value);
    } else if (field === 'stock') {
      updated[index][field] = parseInt(value) || 0;
    } else {
      updated[index][field] = value;
    }
    setVariantList(updated);

    const opts = {};
    types.filter((t) => t.name.trim() && t.values.trim()).forEach((t) => {
      opts[t.name.trim()] = t.values.split(',').map((v) => v.trim()).filter(Boolean);
    });
    onChange(Object.keys(opts).length > 0 ? opts : null, updated.length > 0 ? updated : null);
  };

  const totalVariantStock = variantList.reduce((sum, v) => sum + (v.stock || 0), 0);

  return (
    <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
      <label className="checkbox-label" style={{ paddingTop: 0, marginBottom: '1rem' }}>
        <input type="checkbox" checked={enabled} onChange={(e) => handleToggle(e.target.checked)} />
        This product has variants (size, color, etc.)
      </label>

      {enabled && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
          <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Variant Types
          </h4>

          {types.map((type, i) => (
            <div key={i} className="form-row" style={{ marginBottom: '0.5rem', alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Type Name</label>
                <input
                  value={type.name}
                  onChange={(e) => {
                    const updated = [...types];
                    updated[i].name = e.target.value;
                    handleTypesChange(updated);
                  }}
                  placeholder="e.g. Size, Color"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0, flex: 2 }}>
                <label>Values (comma separated)</label>
                <input
                  value={type.values}
                  onChange={(e) => {
                    const updated = [...types];
                    updated[i].values = e.target.value;
                    handleTypesChange(updated);
                  }}
                  placeholder="e.g. S, M, L, XL"
                />
              </div>
              <button
                type="button"
                onClick={() => handleTypesChange(types.filter((_, j) => j !== i))}
                style={{
                  background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  padding: '0.55rem', cursor: 'pointer', color: 'var(--danger)', display: 'flex',
                  marginBottom: '0',
                }}
              >
                <HiTrash />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => handleTypesChange([...types, { name: '', values: '' }])}
            style={{
              background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--radius)',
              padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--copper)',
              fontWeight: 500, marginTop: '0.5rem', width: '100%',
            }}
          >
            + Add Variant Type
          </button>

          {variantList.length > 0 && (
            <>
              <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', margin: '1.25rem 0 0.75rem' }}>
                Variants ({variantList.length}) — Total Stock: {totalVariantStock}
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-warm)' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Variant</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>SKU</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Price Override</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variantList.map((v, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '0.4rem 0.5rem', fontWeight: 500 }}>
                          {Object.values(v.options).join(' / ')}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>
                          <input
                            value={v.sku}
                            onChange={(e) => handleVariantFieldChange(i, 'sku', e.target.value)}
                            placeholder="SKU"
                            style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.82rem', width: '100px' }}
                          />
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={v.price ?? ''}
                            onChange={(e) => handleVariantFieldChange(i, 'price', e.target.value)}
                            placeholder="Base price"
                            style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.82rem', width: '90px' }}
                          />
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>
                          <input
                            type="number"
                            value={v.stock}
                            onChange={(e) => handleVariantFieldChange(i, 'stock', e.target.value)}
                            style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.82rem', width: '70px' }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BannerEditor() {
  const [banners, setBanners] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.get('/settings/banners').then((res) => {
      if (Array.isArray(res.data)) setBanners(res.data);
    }).catch(() => {});
  }, []);

  const saveBanners = async (updated) => {
    try {
      await api.put('/settings/banners', { banners: updated });
      setBanners(updated);
      toast.success('Banners saved');
    } catch (err) {
      toast.error('Failed to save banners');
    }
  };

  const handleUpload = async (file) => {
    if (!file || banners.length >= 5) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newBanner = { image: data.url, title: '', subtitle: '', link: '/products' };
      const updated = [...banners, newBanner];
      await saveBanners(updated);
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const updateBanner = (index, field, value) => {
    const updated = banners.map((b, i) => i === index ? { ...b, [field]: value } : b);
    setBanners(updated);
  };

  const removeBanner = (index) => {
    const updated = banners.filter((_, i) => i !== index);
    saveBanners(updated);
  };

  const moveBanner = (index, dir) => {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= banners.length) return;
    const updated = [...banners];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    saveBanners(updated);
  };

  return (
    <div style={{ marginTop: '3rem' }}>
      <h3 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '1rem' }}>
        Home Banners ({banners.length}/5)
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
        Add up to 5 banner slides for the home page carousel. Each banner needs an image, and optionally a title, subtitle, and link.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        {banners.map((banner, i) => (
          <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: '140px 1fr auto',
            gap: '1rem',
            padding: '1rem',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-card)',
            alignItems: 'start',
          }}>
            <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', aspectRatio: '16/10' }}>
              <img src={banner.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input
                value={banner.title || ''}
                onChange={(e) => updateBanner(i, 'title', e.target.value)}
                onBlur={() => saveBanners(banners)}
                placeholder="Banner title (e.g. Traditional style for the new generation.)"
                style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.88rem', background: 'var(--bg-warm)' }}
              />
              <input
                value={banner.subtitle || ''}
                onChange={(e) => updateBanner(i, 'subtitle', e.target.value)}
                onBlur={() => saveBanners(banners)}
                placeholder="Subtitle (e.g. Kids Collection)"
                style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.82rem', background: 'var(--bg-warm)' }}
              />
              <input
                value={banner.link || ''}
                onChange={(e) => updateBanner(i, 'link', e.target.value)}
                onBlur={() => saveBanners(banners)}
                placeholder="Link (e.g. /products?category=Kids)"
                style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.82rem', background: 'var(--bg-warm)' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <button
                onClick={() => moveBanner(i, -1)}
                disabled={i === 0}
                style={{ padding: '0.3rem 0.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-warm)', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1, fontSize: '0.75rem' }}
              >
                ▲
              </button>
              <button
                onClick={() => moveBanner(i, 1)}
                disabled={i === banners.length - 1}
                style={{ padding: '0.3rem 0.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-warm)', cursor: i === banners.length - 1 ? 'default' : 'pointer', opacity: i === banners.length - 1 ? 0.3 : 1, fontSize: '0.75rem' }}
              >
                ▼
              </button>
              <button
                onClick={() => removeBanner(i)}
                style={{ padding: '0.3rem 0.5rem', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                <HiTrash />
              </button>
            </div>
          </div>
        ))}
      </div>

      {banners.length < 5 && (
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.7rem 1.5rem', border: '2px dashed var(--border)',
          borderRadius: 'var(--radius-lg)', cursor: 'pointer',
          fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)',
          transition: 'all 0.25s ease',
        }}>
          <HiPhotograph style={{ fontSize: '1.2rem' }} />
          {uploading ? 'Uploading...' : 'Add Banner Image'}
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => handleUpload(e.target.files[0])}
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );
}

function HeroBannerEditor() {
  const [heroImage, setHeroImage] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.get('/settings/hero-image').then((res) => {
      if (res.data.value) setHeroImage(res.data.value);
    }).catch(() => {});
  }, []);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setHeroImage(data.url);
      await api.put('/settings/hero-image', { value: data.url });
      toast.success('Hero banner updated');
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ marginTop: '3rem' }}>
      <h3 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '1rem' }}>
        Hero Banner Image
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
        This image appears as the main banner on the home page.
      </p>

      {heroImage && (
        <div style={{ marginBottom: '1rem', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-light)', maxWidth: '500px' }}>
          <img src={heroImage} alt="Hero Banner" style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }} />
        </div>
      )}

      <label style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.7rem 1.5rem', border: '2px dashed var(--border)',
        borderRadius: 'var(--radius-lg)', cursor: 'pointer',
        fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)',
        transition: 'all 0.25s ease',
      }}>
        <HiPhotograph style={{ fontSize: '1.2rem' }} />
        {uploading ? 'Uploading...' : heroImage ? 'Change Banner' : 'Upload Banner Image'}
        <input
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => handleUpload(e.target.files[0])}
        />
      </label>
    </div>
  );
}

function ImageUploader({ images = [], onChange }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const uploadFiles = async (files) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast.error('Please select image files');
      return;
    }

    setUploading(true);
    try {
      const uploaded = [];
      for (const file of imageFiles) {
        const formData = new FormData();
        formData.append('image', file);
        const { data } = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploaded.push(data.url);
      }
      onChange([...images, ...uploaded]);
      toast.success(`${uploaded.length} image${uploaded.length > 1 ? 's' : ''} uploaded`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  };

  const removeImage = (index) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="image-uploader">
      <label style={{
        fontSize: '0.72rem', fontWeight: 600,
        marginBottom: '0.5rem', display: 'block',
        color: 'var(--text-secondary)',
        letterSpacing: '1px', textTransform: 'uppercase',
      }}>
        Product Images
      </label>

      {/* Existing images */}
      {images.length > 0 && (
        <div style={{
          display: 'flex', gap: '0.75rem', flexWrap: 'wrap',
          marginBottom: '0.75rem',
        }}>
          {images.map((url, i) => (
            <div key={i} style={{
              position: 'relative', width: 90, height: 90,
              borderRadius: 'var(--radius)', overflow: 'hidden',
              border: '1px solid var(--border)',
            }}>
              <img
                src={url}
                alt={`Product ${i + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 22, height: 22,
                  background: 'rgba(0,0,0,0.65)', color: 'white',
                  border: 'none', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: '0.75rem',
                  padding: 0,
                }}
              >
                <HiX />
              </button>
              {i === 0 && (
                <span style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'rgba(0,0,0,0.6)', color: 'white',
                  fontSize: '0.6rem', textAlign: 'center', padding: '2px 0',
                  fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase',
                }}>
                  Main
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? 'var(--copper)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s var(--ease)',
          background: dragOver ? 'rgba(196,120,74,0.04)' : 'var(--bg-warm)',
        }}
      >
        {uploading ? (
          <div style={{ color: 'var(--copper)', fontWeight: 500, fontSize: '0.88rem' }}>
            Uploading...
          </div>
        ) : (
          <>
            <HiPhotograph style={{
              fontSize: '2rem', color: 'var(--text-light)',
              marginBottom: '0.5rem',
            }} />
            <p style={{
              fontSize: '0.88rem', color: 'var(--text-secondary)',
              fontWeight: 500, marginBottom: '0.25rem',
            }}>
              Drop images here or click to browse
            </p>
            <p style={{
              fontSize: '0.75rem', color: 'var(--text-light)',
            }}>
              JPG, PNG, WebP up to 5MB
            </p>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => uploadFiles(e.target.files)}
      />
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const { currentTheme, changeTheme, themes: themeOptions } = useTheme();
  const [tab, setTab] = useState(() => {
    if (user?.role === 'staff' && user?.permissions?.length > 0) {
      const permToTab = { analytics: 'dashboard', products: 'products', orders: 'orders', categories: 'categories', customers: 'customers', coupons: 'coupons', reviews: 'reviews', settings: 'theme' };
      return permToTab[user.permissions[0]] || 'dashboard';
    }
    return 'dashboard';
  });
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [couponForm, setCouponForm] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewForm, setReviewForm] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [guestCustomers, setGuestCustomers] = useState([]);
  const [customerView, setCustomerView] = useState('registered');
  const [customerOrders, setCustomerOrders] = useState(null); // { name, orders }
  const [customerSearch, setCustomerSearch] = useState('');
  const [adminCategories, setAdminCategories] = useState([]);
  const [catForm, setCatForm] = useState(null);
  const [catUploading, setCatUploading] = useState(false);
  const [pincodes, setPincodes] = useState([]);
  const [pincodeForm, setPincodeForm] = useState(null);
  const [pincodeSearch, setPincodeSearch] = useState('');
  const [bulkPincodes, setBulkPincodes] = useState('');
  const [abandonedCarts, setAbandonedCarts] = useState([]);
  const [abandonedStats, setAbandonedStats] = useState({});
  const [abandonedFilter, setAbandonedFilter] = useState('');
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [staffForm, setStaffForm] = useState(null);
  const [availablePerms, setAvailablePerms] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [revenueChart, setRevenueChart] = useState([]);
  const [chartPeriod, setChartPeriod] = useState('30days');
  const [topProducts, setTopProducts] = useState([]);
  const [orderStatus, setOrderStatus] = useState({});
  const [recentOrders, setRecentOrders] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [availableGateways, setAvailableGateways] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (tab === 'dashboard') {
      Promise.all([
        api.get('/analytics/overview'),
        api.get(`/analytics/revenue-chart?period=${chartPeriod}`),
        api.get('/analytics/top-products'),
        api.get('/analytics/order-status'),
        api.get('/analytics/recent-orders'),
        api.get('/analytics/payment-methods'),
        api.get('/analytics/low-stock'),
      ]).then(([ov, rc, tp, os, ro, pm, ls]) => {
        setDashboard(ov.data);
        setRevenueChart(rc.data);
        setTopProducts(tp.data);
        setOrderStatus(os.data);
        setRecentOrders(ro.data);
        setPaymentMethods(pm.data);
        setLowStockProducts(ls.data);
      }).catch(console.error);
    } else if (tab === 'products') {
      api.get('/products/admin/all').then((res) => setProducts(res.data.products));
      if (adminCategories.length === 0) api.get('/categories/all').then((res) => setAdminCategories(res.data));
    } else if (tab === 'orders') {
      api.get('/orders/all?limit=50').then((res) => setOrders(res.data.orders));
    } else if (tab === 'coupons') {
      api.get('/coupons').then((res) => setCoupons(res.data));
      if (products.length === 0) api.get('/products/admin/all').then((res) => setProducts(res.data.products));
      if (adminCategories.length === 0) api.get('/categories/all').then((res) => setAdminCategories(res.data));
      if (availableGateways.length === 0) api.get('/payment/gateways').then((res) => setAvailableGateways(res.data));
    } else if (tab === 'categories') {
      api.get('/categories/all').then((res) => setAdminCategories(res.data));
    } else if (tab === 'customers') {
      api.get(`/customers?search=${customerSearch}`).then((res) => setCustomers(res.data.customers));
      api.get('/customers/guests').then((res) => setGuestCustomers(res.data));
    } else if (tab === 'abandoned') {
      api.get(`/abandoned-cart?status=${abandonedFilter}`).then((res) => {
        setAbandonedCarts(res.data.carts);
        setAbandonedStats(res.data.stats);
      });
    } else if (tab === 'pincodes') {
      api.get(`/pincodes?search=${pincodeSearch}&limit=100`).then((res) => setPincodes(res.data.pincodes));
    } else if (tab === 'staff') {
      api.get('/staff').then((res) => setStaffList(res.data)).catch(() => {});
      api.get('/staff/permissions').then((res) => setAvailablePerms(res.data)).catch(() => {});
    } else if (tab === 'reviews') {
      api.get('/reviews/all').then((res) => setReviews(res.data.reviews));
      if (products.length === 0) {
        api.get('/products/admin/all').then((res) => setProducts(res.data.products));
      }
    }
  }, [tab, chartPeriod, customerSearch, pincodeSearch, abandonedFilter]);

  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff';
  const userPerms = user?.permissions || [];

  const hasAccess = (perm) => isAdmin || userPerms.includes(perm);

  if (!isAdmin && !isStaff) {
    return <div className="empty-state"><h2>Access Denied</h2></div>;
  }

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      if (editing) {
        await api.put(`/products/${editing}`, payload);
        toast.success('Product updated');
      } else {
        await api.post('/products', payload);
        toast.success('Product created');
      }
      setShowForm(false);
      setEditing(null);
      setForm(emptyProduct);
      const res = await api.get('/products/admin/all');
      setProducts(res.data.products);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this product?')) return;
    await api.delete(`/products/${id}`);
    setProducts(products.filter((p) => p.id !== id));
    toast.success('Deleted');
  };

  const handleToggleActive = async (id) => {
    try {
      const res = await api.patch(`/products/${id}/toggle-active`);
      setProducts(products.map((p) => p.id === id ? { ...p, active: res.data.active } : p));
      toast.success(res.data.active ? 'Product is now Active' : 'Product is now Unlisted');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleStatusChange = async (orderId, orderStatus) => {
    await api.put(`/orders/${orderId}/status`, { orderStatus });
    setOrders(orders.map((o) => o.id === orderId ? { ...o, orderStatus } : o));
    toast.success('Status updated');
  };

  return (
    <div className="admin-page">
      <div className="container">
        <h1>Admin Panel</h1>
        <div className="admin-tabs">
          {hasAccess('analytics') && <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>Dashboard</button>}
          {hasAccess('products') && <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>Products</button>}
          {hasAccess('orders') && <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>Orders</button>}
          {hasAccess('categories') && <button className={tab === 'categories' ? 'active' : ''} onClick={() => setTab('categories')}>Categories</button>}
          {hasAccess('customers') && <button className={tab === 'customers' ? 'active' : ''} onClick={() => setTab('customers')}>Customers</button>}
          {hasAccess('coupons') && <button className={tab === 'coupons' ? 'active' : ''} onClick={() => setTab('coupons')}>Coupons</button>}
          {hasAccess('reviews') && <button className={tab === 'reviews' ? 'active' : ''} onClick={() => setTab('reviews')}>Reviews</button>}
          {hasAccess('orders') && <button className={tab === 'abandoned' ? 'active' : ''} onClick={() => setTab('abandoned')}>Abandoned</button>}
          {hasAccess('settings') && <button className={tab === 'pincodes' ? 'active' : ''} onClick={() => setTab('pincodes')}>Pincodes</button>}
          {hasAccess('settings') && <button className={tab === 'theme' ? 'active' : ''} onClick={() => setTab('theme')}>Theme</button>}
          {isAdmin && <button className={tab === 'staff' ? 'active' : ''} onClick={() => setTab('staff')}>Staff</button>}
        </div>

        {tab === 'dashboard' && dashboard && (
          <div className="dashboard">
            {/* Metric Cards */}
            <div className="dash-cards">
              <div className="dash-card">
                <div className="dash-card-label">Total Revenue</div>
                <div className="dash-card-value">{CURRENCY}{dashboard.revenue.total.toLocaleString('en-IN')}</div>
                <div className={`dash-card-change ${dashboard.revenue.growth >= 0 ? 'up' : 'down'}`}>
                  {dashboard.revenue.growth >= 0 ? '↑' : '↓'} {Math.abs(dashboard.revenue.growth)}% vs last month
                </div>
              </div>
              <div className="dash-card">
                <div className="dash-card-label">This Month</div>
                <div className="dash-card-value">{CURRENCY}{dashboard.revenue.month.toLocaleString('en-IN')}</div>
                <div className="dash-card-sub">Today: {CURRENCY}{dashboard.revenue.today.toLocaleString('en-IN')}</div>
              </div>
              <div className="dash-card">
                <div className="dash-card-label">Orders</div>
                <div className="dash-card-value">{dashboard.orders.total}</div>
                <div className="dash-card-sub">{dashboard.orders.pending} pending · {dashboard.orders.today} today</div>
              </div>
              <div className="dash-card">
                <div className="dash-card-label">Customers</div>
                <div className="dash-card-value">{dashboard.customers.total}</div>
                <div className="dash-card-sub">{dashboard.customers.new} new this month</div>
              </div>
            </div>

            <div className="dash-grid">
              {/* Revenue Chart */}
              <div className="dash-panel dash-chart-panel">
                <div className="dash-panel-header">
                  <h3>Revenue</h3>
                  <div className="dash-chart-toggle">
                    <button className={chartPeriod === '30days' ? 'active' : ''} onClick={() => setChartPeriod('30days')}>30 Days</button>
                    <button className={chartPeriod === '12months' ? 'active' : ''} onClick={() => setChartPeriod('12months')}>12 Months</button>
                  </div>
                </div>
                <div className="dash-chart">
                  {revenueChart.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: '2rem' }}>No revenue data yet</p>
                  ) : (
                    <div className="chart-bars">
                      {(() => {
                        const maxRev = Math.max(...revenueChart.map((d) => d.revenue), 1);
                        return revenueChart.map((d, i) => (
                          <div key={i} className="chart-bar-col" title={`${d.period}: ${CURRENCY}${d.revenue.toLocaleString('en-IN')} (${d.orders} orders)`}>
                            <div className="chart-bar" style={{ height: `${(d.revenue / maxRev) * 100}%` }} />
                            <span className="chart-bar-label">
                              {chartPeriod === '12months'
                                ? new Date(d.period + '-01').toLocaleDateString('en-IN', { month: 'short' })
                                : new Date(d.period).getDate()
                              }
                            </span>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Order Status */}
              <div className="dash-panel">
                <h3>Order Status</h3>
                <div className="dash-status-list">
                  {Object.entries(orderStatus).map(([status, count]) => {
                    const colors = { processing: '#f59e0b', confirmed: '#3b82f6', shipped: '#8b5cf6', delivered: '#10b981', cancelled: '#ef4444' };
                    const total = Object.values(orderStatus).reduce((s, c) => s + c, 0) || 1;
                    return (
                      <div key={status} className="dash-status-row">
                        <div className="dash-status-info">
                          <span className="dash-status-dot" style={{ background: colors[status] || '#999' }} />
                          <span style={{ textTransform: 'capitalize' }}>{status}</span>
                        </div>
                        <div className="dash-status-bar-wrap">
                          <div className="dash-status-bar" style={{ width: `${(count / total) * 100}%`, background: colors[status] || '#999' }} />
                        </div>
                        <span className="dash-status-count">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="dash-grid">
              {/* Top Products */}
              <div className="dash-panel">
                <h3>Top Selling Products</h3>
                {topProducts.length === 0 ? (
                  <p style={{ color: 'var(--text-light)', padding: '1rem 0' }}>No sales data yet</p>
                ) : (
                  <div className="dash-top-products">
                    {topProducts.map((p, i) => (
                      <div key={p.id} className="dash-top-row">
                        <span className="dash-top-rank">{i + 1}</span>
                        <div className="dash-top-info">
                          <span className="dash-top-name">{p.name}</span>
                          <span className="dash-top-qty">{p.quantity} sold</span>
                        </div>
                        <span className="dash-top-rev">{CURRENCY}{p.revenue.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Orders + Payment Methods */}
              <div className="dash-panel">
                <h3>Recent Orders</h3>
                <div className="dash-recent">
                  {recentOrders.slice(0, 7).map((o) => (
                    <div key={o.id} className="dash-recent-row">
                      <div>
                        <span className="dash-recent-id">{o.orderNumber}</span>
                        <span className="dash-recent-name">{o.User?.name || o.guestEmail || 'Guest'}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="dash-recent-amount">{CURRENCY}{parseFloat(o.totalAmount).toLocaleString('en-IN')}</span>
                        <span className={`dash-recent-status ${o.paymentStatus}`}>{o.paymentStatus}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {paymentMethods.length > 0 && (
                  <>
                    <h4 style={{ marginTop: '1.5rem', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>Payment Methods</h4>
                    <div className="dash-payment-methods">
                      {paymentMethods.map((pm) => (
                        <div key={pm.method} className="dash-pm-row">
                          <span style={{ textTransform: 'capitalize' }}>{pm.method}</span>
                          <span>{pm.count} orders · {CURRENCY}{pm.revenue.toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Inventory Alerts */}
            {lowStockProducts.length > 0 && (
              <div className="dash-panel">
                <h3>Inventory Alerts ({lowStockProducts.length})</h3>
                <div className="dash-alert-items" style={{ marginBottom: '1rem' }}>
                  {dashboard.products.outOfStock > 0 && (
                    <div className="dash-alert danger">
                      <strong>{dashboard.products.outOfStock}</strong> out of stock
                    </div>
                  )}
                  {dashboard.products.lowStock > 0 && (
                    <div className="dash-alert warning">
                      <strong>{dashboard.products.lowStock}</strong> low stock (≤5)
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {lowStockProducts.map((p) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: p.stock === 0 ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.04)', borderRadius: 'var(--radius)', border: `1px solid ${p.stock === 0 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)'}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>{p.category}</span>
                      </div>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: p.stock === 0 ? 'var(--danger)' : '#f59e0b', minWidth: '60px', textAlign: 'right' }}>
                        {p.stock === 0 ? 'Out' : `${p.stock} left`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'products' && (
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={() => { setShowForm(true); setEditing(null); setForm(emptyProduct); }}
              >
                <HiPlus /> Add Product
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => window.open('/api/bulk-products/export', '_blank')}
              >
                Export CSV
              </button>
              <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
                Import CSV
                <input
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const formData = new FormData();
                    formData.append('file', file);
                    try {
                      const { data } = await api.post('/bulk-products/import', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                      });
                      toast.success(data.message);
                      if (data.errors?.length > 0) {
                        data.errors.forEach((err) => toast.error(err));
                      }
                      api.get('/products/admin/all').then((res) => setProducts(res.data.products));
                    } catch (error) {
                      toast.error(error.response?.data?.message || 'Import failed');
                    }
                    e.target.value = '';
                  }}
                />
              </label>
              <button
                className="btn btn-secondary"
                onClick={() => window.open('/api/bulk-products/template', '_blank')}
                style={{ fontSize: '0.75rem' }}
              >
                Download Template
              </button>
            </div>

            {showForm && (
              <div className="admin-form-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
                <form className="admin-form" onSubmit={handleProductSubmit}>
                  <h3>{editing ? 'Edit Product' : 'New Product'}</h3>

                  <ImageUploader
                    images={form.images || []}
                    onChange={(images) => setForm({ ...form, images })}
                  />

                  <div style={{ marginTop: '1.25rem' }}>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Name</label>
                        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                      </div>
                      <div className="form-group">
                        <label>Category</label>
                        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                          <option value="">Select category</option>
                          {adminCategories.map((cat) => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Description</label>
                      <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Price</label>
                        <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
                      </div>
                      <div className="form-group">
                        <label>Compare Price</label>
                        <input type="number" step="0.01" value={form.comparePrice} onChange={(e) => setForm({ ...form, comparePrice: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label>Stock</label>
                        <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Brand</label>
                        <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="checkbox-label">
                          <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
                          Featured
                        </label>
                      </div>
                    </div>
                    <div className="form-row" style={{ alignItems: 'end' }}>
                      <div className="form-group">
                        <label className="checkbox-label" style={{ paddingTop: 0 }}>
                          <input type="checkbox" checked={!!form.taxable} onChange={(e) => setForm({ ...form, taxable: e.target.checked, taxRate: e.target.checked ? (parseFloat(form.taxRate) || 18) : 0 })} />
                          Charge GST
                        </label>
                      </div>
                      {form.taxable && (
                        <>
                          <div className="form-group">
                            <label>GST Rate (%)</label>
                            <select value={String(parseFloat(form.taxRate) || 18)} onChange={(e) => setForm({ ...form, taxRate: parseFloat(e.target.value) })}>
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>HSN Code</label>
                            <input value={form.hsnCode || ''} onChange={(e) => setForm({ ...form, hsnCode: e.target.value })} placeholder="Optional" />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <VariantEditor
                    variantOptions={form.variantOptions}
                    variants={form.variants}
                    basePrice={form.price}
                    onChange={(variantOptions, variants) => {
                      const totalStock = variants ? variants.reduce((s, v) => s + (v.stock || 0), 0) : form.stock;
                      setForm({ ...form, variantOptions, variants, stock: totalStock });
                    }}
                  />

                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary">
                      {editing ? 'Update Product' : 'Create Product'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="admin-table">
              <table>
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Featured</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td style={{ width: 56, padding: '0.5rem' }}>
                        <div style={{ width: 44, height: 44, borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                          <ProductImage product={p} size="small" />
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{p.name}</td>
                      <td>{p.category}</td>
                      <td>{CURRENCY}{parseFloat(p.price).toFixed(2)}</td>
                      <td>{p.stock}</td>
                      <td>{p.featured ? 'Yes' : 'No'}</td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem',
                          borderRadius: '100px',
                          background: p.active ? 'rgba(90,138,106,0.1)' : 'rgba(196,90,74,0.1)',
                          color: p.active ? 'var(--success)' : 'var(--danger)',
                        }}>
                          {p.active ? 'Active' : 'Unlisted'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="icon-btn"
                          title={p.active ? 'Unlist product' : 'Make active'}
                          onClick={() => handleToggleActive(p.id)}
                        >
                          {p.active ? <HiEyeOff /> : <HiEye />}
                        </button>
                        <button
                          className="icon-btn"
                          onClick={() => {
                            setForm({
                              ...p,
                              images: p.images || [],
                              taxable: !!p.taxable,
                              taxRate: parseFloat(p.taxRate) || 0,
                              hsnCode: p.hsnCode || '',
                            });
                            setEditing(p.id);
                            setShowForm(true);
                          }}
                        >
                          <HiPencil />
                        </button>
                        <button className="icon-btn danger" onClick={() => handleDelete(p.id)}>
                          <HiTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'orders' && (
          <div className="admin-table">
            <table>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Update</th>
                  <th>Refund</th>
                  <th>Invoice</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.orderNumber}</td>
                    <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td>{CURRENCY}{parseFloat(o.totalAmount).toFixed(2)}</td>
                    <td>{o.paymentStatus}</td>
                    <td>{o.orderStatus}</td>
                    <td>
                      <select
                        value={o.orderStatus}
                        onChange={(e) => handleStatusChange(o.id, e.target.value)}
                      >
                        <option value="processing">Processing</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td>
                      {o.refundStatus === 'pending' ? (
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button className="icon-btn" style={{ color: 'var(--success)', fontSize: '0.7rem', fontWeight: 700 }}
                            onClick={async () => {
                              await api.post(`/orders/${o.id}/refund`, { refundAmount: o.totalAmount });
                              toast.success('Refund processed');
                              api.get('/orders/all?limit=50').then((res) => setOrders(res.data.orders));
                            }}>✓</button>
                          <button className="icon-btn danger" style={{ fontSize: '0.7rem', fontWeight: 700 }}
                            onClick={async () => {
                              await api.post(`/orders/${o.id}/refund-reject`);
                              toast.success('Refund rejected');
                              api.get('/orders/all?limit=50').then((res) => setOrders(res.data.orders));
                            }}>✕</button>
                        </div>
                      ) : o.refundStatus === 'processed' ? (
                        <span style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 600 }}>Done</span>
                      ) : o.refundStatus === 'failed' ? (
                        <span style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 600 }}>Rejected</span>
                      ) : o.paymentStatus === 'paid' ? (
                        <button className="icon-btn" style={{ fontSize: '0.65rem', fontWeight: 600 }}
                          onClick={async () => {
                            if (!confirm(`Refund Rs.${parseFloat(o.totalAmount).toFixed(2)}?`)) return;
                            await api.post(`/orders/${o.id}/refund`, { refundAmount: o.totalAmount });
                            toast.success('Refund processed');
                            api.get('/orders/all?limit=50').then((res) => setOrders(res.data.orders));
                          }}>Refund</button>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <button className="invoice-btn" onClick={() => window.open(`/api/orders/${o.id}/invoice`, '_blank')}>
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'categories' && (
          <div>
            <button
              className="btn btn-primary"
              onClick={() => setCatForm({ name: '', image: '', sortOrder: 0, active: true, _editing: false })}
              style={{ marginBottom: '1.5rem' }}
            >
              <HiPlus /> Add Category
            </button>

            {catForm && (
              <div className="admin-form-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCatForm(null); }}>
                <form className="admin-form" onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const payload = { name: catForm.name, image: catForm.image, sortOrder: catForm.sortOrder, active: catForm.active };
                    if (catForm._editing) {
                      await api.put(`/categories/${catForm._id}`, payload);
                      toast.success('Category updated');
                    } else {
                      await api.post('/categories', payload);
                      toast.success('Category created');
                    }
                    setCatForm(null);
                    api.get('/categories/all').then((res) => setAdminCategories(res.data));
                  } catch (error) {
                    toast.error(error.response?.data?.message || 'Failed');
                  }
                }}>
                  <h3>{catForm._editing ? 'Edit Category' : 'New Category'}</h3>
                  <div className="form-group">
                    <label>Category Name</label>
                    <input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Category Image</label>
                    {catForm.image && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <img src={catForm.image} alt="Preview" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: '12px', border: '1px solid var(--border)' }} />
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          setCatUploading(true);
                          try {
                            const formData = new FormData();
                            formData.append('image', file);
                            const { data } = await api.post('/upload', formData, {
                              headers: { 'Content-Type': 'multipart/form-data' },
                            });
                            setCatForm({ ...catForm, image: data.url });
                          } catch (err) {
                            toast.error('Upload failed');
                          } finally {
                            setCatUploading(false);
                          }
                        }}
                        style={{ flex: 1 }}
                      />
                      {catUploading && <span style={{ fontSize: '0.82rem', color: 'var(--copper)' }}>Uploading...</span>}
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Sort Order</label>
                      <input type="number" value={catForm.sortOrder} onChange={(e) => setCatForm({ ...catForm, sortOrder: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div className="form-group">
                      <label className="checkbox-label" style={{ paddingTop: 0 }}>
                        <input type="checkbox" checked={catForm.active} onChange={(e) => setCatForm({ ...catForm, active: e.target.checked })} />
                        Active
                      </label>
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary">{catForm._editing ? 'Update' : 'Create'}</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setCatForm(null)}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            <div className="admin-table">
              <table>
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Name</th>
                    <th>Order</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminCategories.map((c) => (
                    <tr key={c.id}>
                      <td style={{ width: 56, padding: '0.5rem' }}>
                        {c.image ? (
                          <img src={c.image} alt={c.name} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: '10px' }} />
                        ) : (
                          <div style={{ width: 44, height: 44, borderRadius: '10px', background: 'var(--bg-warm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-light)', fontSize: '0.75rem' }}>
                            No img
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: 500 }}>{c.name}</td>
                      <td>{c.sortOrder}</td>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '100px', background: c.active ? 'rgba(90,138,106,0.1)' : 'rgba(196,90,74,0.1)', color: c.active ? 'var(--success)' : 'var(--danger)' }}>
                          {c.active ? 'Active' : 'Hidden'}
                        </span>
                      </td>
                      <td>
                        <button className="icon-btn" onClick={() => setCatForm({ ...c, _editing: true, _id: c.id })}>
                          <HiPencil />
                        </button>
                        <button className="icon-btn danger" onClick={async () => {
                          if (!confirm('Delete this category?')) return;
                          await api.delete(`/categories/${c.id}`);
                          setAdminCategories(adminCategories.filter((x) => x.id !== c.id));
                          toast.success('Deleted');
                        }}>
                          <HiTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {adminCategories.length === 0 && (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No categories yet. Add categories to show on the home page.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'customers' && (
          <div>
            {/* Search + Toggle */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                style={{
                  flex: 1, minWidth: '200px', padding: '0.55rem 1rem',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  fontSize: '0.85rem', background: 'var(--bg-card)',
                }}
              />
              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                <button
                  onClick={() => setCustomerView('registered')}
                  style={{
                    padding: '0.55rem 1rem', border: 'none', cursor: 'pointer',
                    fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase',
                    background: customerView === 'registered' ? 'var(--bg-dark)' : 'var(--bg-card)',
                    color: customerView === 'registered' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  }}
                >
                  Registered ({customers.length})
                </button>
                <button
                  onClick={() => setCustomerView('guests')}
                  style={{
                    padding: '0.55rem 1rem', border: 'none', borderLeft: '1px solid var(--border)',
                    cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase',
                    background: customerView === 'guests' ? 'var(--bg-dark)' : 'var(--bg-card)',
                    color: customerView === 'guests' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  }}
                >
                  Guests ({guestCustomers.length})
                </button>
              </div>
            </div>

            {/* Order History Modal */}
            {customerOrders && (
              <div className="admin-form-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCustomerOrders(null); }}>
                <div className="admin-form" style={{ maxWidth: '700px' }}>
                  <h3>{customerOrders.name}'s Orders</h3>
                  {customerOrders.orders.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', padding: '1rem 0' }}>No orders found</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {customerOrders.orders.map((o) => (
                        <div key={o.id} style={{
                          border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)',
                          padding: '1rem', fontSize: '0.85rem',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <strong>{o.orderNumber}</strong>
                            <span style={{ color: o.paymentStatus === 'paid' ? 'var(--success)' : 'var(--copper)', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase' }}>
                              {o.paymentStatus}
                            </span>
                          </div>
                          <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            {new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' · '}{o.paymentMethod} · <strong>{CURRENCY}{parseFloat(o.totalAmount).toFixed(2)}</strong>
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            {o.items.map((item, i) => (
                              <span key={i}>
                                {item.name}{item.variant ? ` (${Object.entries(item.variant).filter(([k]) => k !== 'sku').map(([k,v]) => v).join(', ')})` : ''} x{item.quantity}
                                {i < o.items.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="form-actions">
                    <button className="btn btn-secondary" onClick={() => setCustomerOrders(null)}>Close</button>
                  </div>
                </div>
              </div>
            )}

            {/* Registered Customers Table */}
            {customerView === 'registered' && (
              <div className="admin-table">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Orders</th>
                      <th>Total Spent</th>
                      <th>Joined</th>
                      <th>History</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 500 }}>{c.name}</td>
                        <td>{c.email}</td>
                        <td>{c.phone || '-'}</td>
                        <td>{c.orderCount}</td>
                        <td>{CURRENCY}{c.totalSpent.toFixed(2)}</td>
                        <td>{new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                        <td>
                          <button
                            className="icon-btn"
                            onClick={async () => {
                              const { data } = await api.get(`/customers/${c.id}/orders`);
                              setCustomerOrders({ name: c.name, orders: data });
                            }}
                            title="View orders"
                          >
                            📋
                          </button>
                        </td>
                      </tr>
                    ))}
                    {customers.length === 0 && (
                      <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No customers found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Guest Customers Table */}
            {customerView === 'guests' && (
              <div className="admin-table">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Orders</th>
                      <th>Total Spent</th>
                      <th>Last Order</th>
                      <th>History</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guestCustomers.map((g, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{g.name}</td>
                        <td>{g.email}</td>
                        <td>{g.phone}</td>
                        <td>{g.orderCount}</td>
                        <td>{CURRENCY}{g.totalSpent.toFixed(2)}</td>
                        <td>{new Date(g.lastOrder).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                        <td>
                          <button
                            className="icon-btn"
                            onClick={async () => {
                              const { data } = await api.get(`/customers/guest-orders?email=${encodeURIComponent(g.email)}`);
                              setCustomerOrders({ name: g.name, orders: data });
                            }}
                            title="View orders"
                          >
                            📋
                          </button>
                        </td>
                      </tr>
                    ))}
                    {guestCustomers.length === 0 && (
                      <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No guest orders yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'coupons' && (
          <div>
            <button
              className="btn btn-primary"
              onClick={() => setCouponForm({ code: '', description: '', type: 'percentage', value: '', minOrderAmount: '', maxDiscount: '', usageLimit: '', perUserLimit: '1', startDate: '', endDate: '', active: true, applicableCategories: null, applicableProducts: null, applicablePaymentMethods: null, _editing: false })}
              style={{ marginBottom: '1.5rem' }}
            >
              <HiPlus /> Create Coupon
            </button>

            {couponForm && (
              <div className="admin-form-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCouponForm(null); }}>
                <form className="admin-form" onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const payload = { ...couponForm };
                    delete payload._editing;
                    delete payload._id;
                    if (payload.applicableCategories && payload.applicableCategories.length === 0) payload.applicableCategories = null;
                    if (payload.applicableProducts && payload.applicableProducts.length === 0) payload.applicableProducts = null;
                    if (payload.applicablePaymentMethods && payload.applicablePaymentMethods.length === 0) payload.applicablePaymentMethods = null;
                    if (couponForm._editing) {
                      await api.put(`/coupons/${couponForm._id}`, payload);
                      toast.success('Coupon updated');
                    } else {
                      await api.post('/coupons', payload);
                      toast.success('Coupon created');
                    }
                    setCouponForm(null);
                    api.get('/coupons').then((res) => setCoupons(res.data));
                  } catch (error) {
                    toast.error(error.response?.data?.message || 'Failed');
                  }
                }}>
                  <h3>{couponForm._editing ? 'Edit Coupon' : 'New Coupon'}</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Code</label>
                      <input value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} required placeholder="e.g. SAVE20" style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }} />
                    </div>
                    <div className="form-group">
                      <label>Type</label>
                      <select value={couponForm.type} onChange={(e) => setCouponForm({ ...couponForm, type: e.target.value })} required>
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">{`Fixed Amount (${CURRENCY})`}</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>{couponForm.type === 'percentage' ? 'Discount (%)' : `Discount (${CURRENCY})`}</label>
                      <input type="number" step="0.01" value={couponForm.value} onChange={(e) => setCouponForm({ ...couponForm, value: e.target.value })} required />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Description (optional)</label>
                    <input value={couponForm.description} onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })} placeholder="e.g. 20% off on your first order" />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Min Order Amount</label>
                      <input type="number" step="0.01" value={couponForm.minOrderAmount} onChange={(e) => setCouponForm({ ...couponForm, minOrderAmount: e.target.value })} placeholder="0" />
                    </div>
                    {couponForm.type === 'percentage' && (
                      <div className="form-group">
                        <label>{`Max Discount Cap (${CURRENCY})`}</label>
                        <input type="number" step="0.01" value={couponForm.maxDiscount} onChange={(e) => setCouponForm({ ...couponForm, maxDiscount: e.target.value })} placeholder="No limit" />
                      </div>
                    )}
                    <div className="form-group">
                      <label>Usage Limit</label>
                      <input type="number" value={couponForm.usageLimit} onChange={(e) => setCouponForm({ ...couponForm, usageLimit: e.target.value })} placeholder="Unlimited" />
                    </div>
                    <div className="form-group">
                      <label>Per User Limit</label>
                      <input type="number" value={couponForm.perUserLimit} onChange={(e) => setCouponForm({ ...couponForm, perUserLimit: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Start Date</label>
                      <input type="date" value={couponForm.startDate?.split('T')[0] || ''} onChange={(e) => setCouponForm({ ...couponForm, startDate: e.target.value || null })} />
                    </div>
                    <div className="form-group">
                      <label>End Date</label>
                      <input type="date" value={couponForm.endDate?.split('T')[0] || ''} onChange={(e) => setCouponForm({ ...couponForm, endDate: e.target.value || null })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Applies To</label>
                    <select
                      value={
                        couponForm.applicableProducts?.length ? 'products' :
                        couponForm.applicableCategories?.length ? 'categories' : 'all'
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        setCouponForm({
                          ...couponForm,
                          applicableCategories: v === 'categories' ? [] : null,
                          applicableProducts: v === 'products' ? [] : null,
                        });
                      }}
                    >
                      <option value="all">All Products</option>
                      <option value="categories">Specific Categories</option>
                      <option value="products">Specific Products</option>
                    </select>
                  </div>

                  {couponForm.applicableCategories !== null && Array.isArray(couponForm.applicableCategories) && (
                    <div className="form-group">
                      <label>Select Categories</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                        {adminCategories.map((cat) => {
                          const name = cat.name || cat;
                          const selected = couponForm.applicableCategories.includes(name);
                          return (
                            <span
                              key={name}
                              onClick={() => {
                                const cats = selected
                                  ? couponForm.applicableCategories.filter((c) => c !== name)
                                  : [...couponForm.applicableCategories, name];
                                setCouponForm({ ...couponForm, applicableCategories: cats });
                              }}
                              style={{ padding: '0.4rem 0.8rem', borderRadius: '100px', border: '1px solid', borderColor: selected ? 'var(--success)' : 'var(--border)', background: selected ? 'rgba(90,138,106,0.1)' : 'transparent', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text)', fontWeight: 500, userSelect: 'none' }}
                            >
                              {name}
                            </span>
                          );
                        })}
                      </div>
                      {couponForm.applicableCategories.length === 0 && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '0.25rem' }}>Select at least one category</p>
                      )}
                    </div>
                  )}

                  {couponForm.applicableProducts !== null && Array.isArray(couponForm.applicableProducts) && (
                    <div className="form-group">
                      <label>Select Products</label>
                      <select
                        onChange={(e) => {
                          const pid = parseInt(e.target.value);
                          if (pid && !couponForm.applicableProducts.includes(pid)) {
                            setCouponForm({ ...couponForm, applicableProducts: [...couponForm.applicableProducts, pid] });
                          }
                          e.target.value = '';
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>Search and select a product...</option>
                        {products.filter((p) => !couponForm.applicableProducts.includes(p.id)).map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                        {couponForm.applicableProducts.map((pid) => {
                          const p = products.find((x) => x.id === pid);
                          return (
                            <span key={pid} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.7rem', borderRadius: '100px', background: 'rgba(90,138,106,0.1)', fontSize: '0.82rem', fontWeight: 500 }}>
                              {p ? p.name : `#${pid}`}
                              <button type="button" onClick={() => setCouponForm({ ...couponForm, applicableProducts: couponForm.applicableProducts.filter((x) => x !== pid) })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '1rem', lineHeight: 1, color: 'var(--danger)' }}>&times;</button>
                            </span>
                          );
                        })}
                      </div>
                      {couponForm.applicableProducts.length === 0 && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '0.25rem' }}>Select at least one product</p>
                      )}
                    </div>
                  )}

                  <div className="form-group">
                    <label>Payment Methods</label>
                    <select
                      value={couponForm.applicablePaymentMethods ? '__specific' : 'all'}
                      onChange={(e) => {
                        setCouponForm({ ...couponForm, applicablePaymentMethods: e.target.value === 'all' ? null : [] });
                      }}
                    >
                      <option value="all">All Payment Methods</option>
                      <option value="__specific">Specific Methods</option>
                    </select>
                    {couponForm.applicablePaymentMethods !== null && Array.isArray(couponForm.applicablePaymentMethods) && (
                      <>
                        <select
                          onChange={(e) => {
                            const id = e.target.value;
                            if (id && !couponForm.applicablePaymentMethods.includes(id)) {
                              setCouponForm({ ...couponForm, applicablePaymentMethods: [...couponForm.applicablePaymentMethods, id] });
                            }
                            e.target.value = '';
                          }}
                          defaultValue=""
                          style={{ marginTop: '0.5rem' }}
                        >
                          <option value="" disabled>Select a payment method...</option>
                          {availableGateways.filter((pm) => !couponForm.applicablePaymentMethods.includes(pm.id)).map((pm) => (
                            <option key={pm.id} value={pm.id}>{pm.name}</option>
                          ))}
                        </select>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                          {couponForm.applicablePaymentMethods.map((mid) => {
                            const pm = availableGateways.find((x) => x.id === mid);
                            return (
                              <span key={mid} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.7rem', borderRadius: '100px', background: 'rgba(90,138,106,0.1)', fontSize: '0.82rem', fontWeight: 500, color: 'var(--text)' }}>
                                {pm ? pm.name : mid}
                                <button type="button" onClick={() => setCouponForm({ ...couponForm, applicablePaymentMethods: couponForm.applicablePaymentMethods.filter((x) => x !== mid) || null })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '1rem', lineHeight: 1, color: 'var(--danger)' }}>&times;</button>
                              </span>
                            );
                          })}
                        </div>
                        {couponForm.applicablePaymentMethods.length === 0 && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '0.25rem' }}>Select at least one payment method</p>
                        )}
                      </>
                    )}
                  </div>

                  <label className="checkbox-label" style={{ paddingTop: '0.5rem' }}>
                    <input type="checkbox" checked={couponForm.active} onChange={(e) => setCouponForm({ ...couponForm, active: e.target.checked })} />
                    Active
                  </label>
                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary">
                      {couponForm._editing ? 'Update' : 'Create'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setCouponForm(null)}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            <div className="admin-table">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Type</th>
                    <th>Value</th>
                    <th>Min Order</th>
                    <th>Applies To</th>
                    <th>Used</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600, letterSpacing: '0.5px' }}>{c.code}</td>
                      <td style={{ textTransform: 'capitalize' }}>{c.type}</td>
                      <td>{c.type === 'percentage' ? `${c.value}%` : `${CURRENCY}${parseFloat(c.value).toFixed(2)}`}{c.maxDiscount ? ` (max ${CURRENCY}${parseFloat(c.maxDiscount).toFixed(0)})` : ''}</td>
                      <td>{parseFloat(c.minOrderAmount) > 0 ? `${CURRENCY}${parseFloat(c.minOrderAmount).toFixed(0)}` : '-'}</td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {c.applicableProducts?.length
                          ? c.applicableProducts.map((pid) => { const p = products.find((x) => x.id === pid); return p ? p.name : `#${pid}`; }).join(', ')
                          : c.applicableCategories?.length
                            ? c.applicableCategories.join(', ')
                            : 'All Products'}
                      </td>
                      <td>{c.usedCount}{c.usageLimit ? `/${c.usageLimit}` : ''}</td>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '100px', background: c.active ? 'rgba(90,138,106,0.1)' : 'rgba(196,90,74,0.1)', color: c.active ? 'var(--success)' : 'var(--danger)' }}>
                          {c.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button className="icon-btn" onClick={() => setCouponForm({ ...c, _editing: true, _id: c.id })}>
                          <HiPencil />
                        </button>
                        <button className="icon-btn danger" onClick={async () => {
                          if (!confirm('Delete this coupon?')) return;
                          await api.delete(`/coupons/${c.id}`);
                          setCoupons(coupons.filter((x) => x.id !== c.id));
                          toast.success('Deleted');
                        }}>
                          <HiTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {coupons.length === 0 && (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No coupons yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'reviews' && (
          <div>
            <button
              className="btn btn-primary"
              onClick={() => setReviewForm({ productId: '', name: '', rating: 5, title: '', comment: '', verified: false })}
              style={{ marginBottom: '1.5rem' }}
            >
              <HiPlus /> Add Review
            </button>

            {reviewForm && (
              <div className="admin-form-overlay" onClick={(e) => { if (e.target === e.currentTarget) setReviewForm(null); }}>
                <form className="admin-form" onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await api.post('/reviews/admin', reviewForm);
                    toast.success('Review added');
                    setReviewForm(null);
                    api.get('/reviews/all').then((res) => setReviews(res.data.reviews));
                  } catch (error) {
                    toast.error(error.response?.data?.message || 'Failed');
                  }
                }}>
                  <h3>Add Review</h3>
                  <div className="form-group">
                    <label>Product</label>
                    <select value={reviewForm.productId} onChange={(e) => setReviewForm({ ...reviewForm, productId: e.target.value })} required>
                      <option value="">Select product</option>
                      {products.length === 0 && <option disabled>Loading products...</option>}
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Reviewer Name</label>
                      <input value={reviewForm.name} onChange={(e) => setReviewForm({ ...reviewForm, name: e.target.value })} required placeholder="John Doe" />
                    </div>
                    <div className="form-group">
                      <label>Rating</label>
                      <select value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: parseInt(e.target.value) })}>
                        <option value="5">5 Stars</option>
                        <option value="4">4 Stars</option>
                        <option value="3">3 Stars</option>
                        <option value="2">2 Stars</option>
                        <option value="1">1 Star</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Title (optional)</label>
                    <input value={reviewForm.title} onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })} placeholder="Great product!" />
                  </div>
                  <div className="form-group">
                    <label>Review</label>
                    <textarea value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} rows={3} required placeholder="Write the review content..." />
                  </div>
                  <label className="checkbox-label" style={{ paddingTop: '0.5rem' }}>
                    <input type="checkbox" checked={reviewForm.verified} onChange={(e) => setReviewForm({ ...reviewForm, verified: e.target.checked })} />
                    Show as "Verified Purchase"
                  </label>
                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary">Add Review</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setReviewForm(null)}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            <div className="admin-table">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Reviewer</th>
                    <th>Rating</th>
                    <th>Comment</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => (
                    <tr key={r.id}>
                      <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.Product?.name || `Product #${r.productId}`}
                      </td>
                      <td>{r.name}</td>
                      <td>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.title ? <strong>{r.title}: </strong> : ''}{r.comment}
                      </td>
                      <td>
                        {r.adminCreated ? (
                          <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.4rem', borderRadius: '100px', background: 'rgba(196,120,74,0.1)', color: 'var(--copper)' }}>Admin</span>
                        ) : r.verified ? (
                          <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.4rem', borderRadius: '100px', background: 'rgba(90,138,106,0.1)', color: 'var(--success)' }}>Verified</span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>Customer</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="icon-btn"
                          onClick={async () => {
                            await api.put(`/reviews/${r.id}/approve`);
                            api.get('/reviews/all').then((res) => setReviews(res.data.reviews));
                            toast.success(r.approved ? 'Hidden' : 'Approved');
                          }}
                          title={r.approved ? 'Hide review' : 'Approve review'}
                          style={{ color: r.approved ? 'var(--success)' : 'var(--text-light)' }}
                        >
                          {r.approved ? '✓' : '○'}
                        </button>
                      </td>
                      <td>
                        <button className="icon-btn danger" onClick={async () => {
                          if (!confirm('Delete this review?')) return;
                          await api.delete(`/reviews/${r.id}`);
                          setReviews(reviews.filter((x) => x.id !== r.id));
                          toast.success('Deleted');
                        }}>
                          <HiTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {reviews.length === 0 && (
                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No reviews yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'abandoned' && (
          <div>
            {/* Stats */}
            <div className="dash-cards" style={{ marginBottom: '1.5rem' }}>
              <div className="dash-card">
                <div className="dash-card-label">Total</div>
                <div className="dash-card-value">{abandonedStats.total || 0}</div>
              </div>
              <div className="dash-card">
                <div className="dash-card-label">Pending</div>
                <div className="dash-card-value">{abandonedStats.pending || 0}</div>
              </div>
              <div className="dash-card">
                <div className="dash-card-label">Email Sent</div>
                <div className="dash-card-value">{abandonedStats.sent || 0}</div>
              </div>
              <div className="dash-card">
                <div className="dash-card-label">Recovered</div>
                <div className="dash-card-value" style={{ color: 'var(--success)' }}>{abandonedStats.recovered || 0}</div>
              </div>
            </div>

            {/* Filter */}
            <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', width: 'fit-content' }}>
              {[
                { val: '', label: 'All' },
                { val: 'pending', label: 'Pending' },
                { val: 'sent', label: 'Sent' },
                { val: 'recovered', label: 'Recovered' },
              ].map((f) => (
                <button key={f.val}
                  onClick={() => setAbandonedFilter(f.val)}
                  style={{ padding: '0.45rem 1rem', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', background: abandonedFilter === f.val ? 'var(--bg-dark)' : 'var(--bg-card)', color: abandonedFilter === f.val ? 'var(--text-inverse)' : 'var(--text-secondary)' }}
                >{f.label}</button>
              ))}
            </div>

            <div className="admin-table">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {abandonedCarts.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.email}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.items.map((i) => i.name).join(', ')}
                      </td>
                      <td>{CURRENCY}{parseFloat(c.cartTotal).toFixed(2)}</td>
                      <td style={{ fontSize: '0.82rem' }}>{new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      <td>
                        {c.recovered ? (
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '100px', background: 'rgba(16,185,129,0.1)', color: 'var(--success)' }}>Recovered</span>
                        ) : c.emailSent ? (
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '100px', background: 'rgba(37,99,235,0.1)', color: '#2563eb' }}>Sent</span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '100px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>Pending</span>
                        )}
                      </td>
                      <td>
                        {!c.recovered && !c.emailSent && (
                          <button className="icon-btn" style={{ fontSize: '0.65rem', fontWeight: 600 }}
                            onClick={async () => {
                              await api.post(`/abandoned-cart/${c.id}/send`);
                              toast.success('Recovery email sent');
                              api.get(`/abandoned-cart?status=${abandonedFilter}`).then((res) => { setAbandonedCarts(res.data.carts); setAbandonedStats(res.data.stats); });
                            }}>Send</button>
                        )}
                        <button className="icon-btn danger" onClick={async () => {
                          await api.delete(`/abandoned-cart/${c.id}`);
                          setAbandonedCarts(abandonedCarts.filter((x) => x.id !== c.id));
                          toast.success('Deleted');
                        }}>
                          <HiTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {abandonedCarts.length === 0 && (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No abandoned carts</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'pincodes' && (
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => setPincodeForm({ pincode: '', city: '', state: '', deliveryDays: 7, codAvailable: true, _editing: false })}>
                <HiPlus /> Add Pincode
              </button>
              <button className="btn btn-secondary" onClick={() => setBulkPincodes(bulkPincodes ? '' : ' ')}>
                {bulkPincodes !== '' ? 'Cancel Bulk' : 'Bulk Add'}
              </button>
            </div>

            {/* Bulk Add */}
            {bulkPincodes !== '' && (
              <div style={{ marginBottom: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>Bulk Add Pincodes</h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Enter pincodes separated by commas, spaces, or new lines.
                </p>
                <textarea
                  value={bulkPincodes.trim()}
                  onChange={(e) => setBulkPincodes(e.target.value)}
                  rows={4}
                  placeholder="673001, 673002, 673003..."
                  style={{ width: '100%', padding: '0.7rem', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.88rem', fontFamily: 'monospace' }}
                />
                <button
                  className="btn btn-primary"
                  style={{ marginTop: '0.75rem' }}
                  onClick={async () => {
                    const pins = bulkPincodes.split(/[,\s\n]+/).map((p) => p.trim()).filter(Boolean);
                    if (pins.length === 0) return;
                    try {
                      const { data } = await api.post('/pincodes/bulk', { pincodes: pins });
                      toast.success(data.message);
                      setBulkPincodes('');
                      api.get(`/pincodes?search=${pincodeSearch}&limit=100`).then((res) => setPincodes(res.data.pincodes));
                    } catch (error) {
                      toast.error(error.response?.data?.message || 'Bulk add failed');
                    }
                  }}
                >
                  Add Pincodes
                </button>
              </div>
            )}

            {/* Single Add/Edit Form */}
            {pincodeForm && (
              <div className="admin-form-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPincodeForm(null); }}>
                <form className="admin-form" style={{ maxWidth: '500px' }} onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    if (pincodeForm._editing) {
                      await api.put(`/pincodes/${pincodeForm._id}`, pincodeForm);
                      toast.success('Pincode updated');
                    } else {
                      await api.post('/pincodes', pincodeForm);
                      toast.success('Pincode added');
                    }
                    setPincodeForm(null);
                    api.get(`/pincodes?search=${pincodeSearch}&limit=100`).then((res) => setPincodes(res.data.pincodes));
                  } catch (error) {
                    toast.error(error.response?.data?.message || 'Failed');
                  }
                }}>
                  <h3>{pincodeForm._editing ? 'Edit Pincode' : 'Add Pincode'}</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Pincode</label>
                      <input value={pincodeForm.pincode} onChange={(e) => setPincodeForm({ ...pincodeForm, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })} required disabled={pincodeForm._editing} />
                    </div>
                    <div className="form-group">
                      <label>Delivery Days</label>
                      <input type="number" value={pincodeForm.deliveryDays} onChange={(e) => setPincodeForm({ ...pincodeForm, deliveryDays: parseInt(e.target.value) || 7 })} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>City</label>
                      <input value={pincodeForm.city} onChange={(e) => setPincodeForm({ ...pincodeForm, city: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>State</label>
                      <input value={pincodeForm.state} onChange={(e) => setPincodeForm({ ...pincodeForm, state: e.target.value })} />
                    </div>
                  </div>
                  <label className="checkbox-label" style={{ paddingTop: '0.5rem' }}>
                    <input type="checkbox" checked={pincodeForm.codAvailable} onChange={(e) => setPincodeForm({ ...pincodeForm, codAvailable: e.target.checked })} />
                    Cash on Delivery Available
                  </label>
                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary">{pincodeForm._editing ? 'Update' : 'Add'}</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setPincodeForm(null)}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {/* Search */}
            <input
              type="text"
              placeholder="Search pincode, city, or state..."
              value={pincodeSearch}
              onChange={(e) => setPincodeSearch(e.target.value)}
              style={{ width: '100%', maxWidth: '350px', padding: '0.55rem 1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.85rem', marginBottom: '1rem', background: 'var(--bg-card)' }}
            />

            <div className="admin-table">
              <table>
                <thead>
                  <tr>
                    <th>Pincode</th>
                    <th>City</th>
                    <th>State</th>
                    <th>Delivery Days</th>
                    <th>COD</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pincodes.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{p.pincode}</td>
                      <td>{p.city || '-'}</td>
                      <td>{p.state || '-'}</td>
                      <td>{p.deliveryDays} days</td>
                      <td>{p.codAvailable ? '✓' : '✕'}</td>
                      <td>
                        <button className="icon-btn" onClick={() => setPincodeForm({ ...p, _editing: true, _id: p.id })}>
                          <HiPencil />
                        </button>
                        <button className="icon-btn danger" onClick={async () => {
                          if (!confirm('Delete this pincode?')) return;
                          await api.delete(`/pincodes/${p.id}`);
                          setPincodes(pincodes.filter((x) => x.id !== p.id));
                          toast.success('Deleted');
                        }}>
                          <HiTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {pincodes.length === 0 && (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      No pincodes added. All deliveries are currently allowed.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: '1rem' }}>
              Note: If no pincodes are added, delivery is allowed to all pincodes. Add pincodes to restrict delivery to specific areas only.
            </p>
          </div>
        )}

        {tab === 'theme' && (
          <div>
            <div className="theme-switcher-section">
              <h3 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '1.5rem' }}>
                Store Theme
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                Choose a theme for your storefront. The selected theme will be visible to all customers.
              </p>
              <div className="theme-grid">
                {themeOptions.map((theme) => (
                  <button
                    key={theme.id}
                    className={`theme-card ${currentTheme === theme.id ? 'active' : ''}`}
                    onClick={() => {
                      changeTheme(theme.id);
                      toast.success(`Theme changed to "${theme.name}"`);
                    }}
                  >
                    <div className={`theme-preview theme-preview-${theme.id}`} />
                    <div className="theme-card-info">
                      <strong>{theme.name}</strong>
                      <span>{theme.description}</span>
                    </div>
                    {currentTheme === theme.id && (
                      <span className="theme-active-badge">Active</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Home Page Banners Carousel */}
            <BannerEditor />
          </div>
        )}

        {tab === 'staff' && isAdmin && (
          <div>
            <button
              className="btn btn-primary"
              onClick={() => setStaffForm({ name: '', email: '', password: '', permissions: [], _editing: false })}
              style={{ marginBottom: '1.5rem' }}
            >
              <HiPlus /> Add Staff Member
            </button>

            {staffForm && (
              <div className="admin-form-overlay" onClick={(e) => { if (e.target === e.currentTarget) setStaffForm(null); }}>
                <form className="admin-form" onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    if (staffForm._editing) {
                      await api.put(`/staff/${staffForm._id}`, {
                        name: staffForm.name,
                        permissions: staffForm.permissions,
                        password: staffForm.password || undefined,
                      });
                      toast.success('Staff updated');
                    } else {
                      await api.post('/staff', staffForm);
                      toast.success('Staff account created');
                    }
                    setStaffForm(null);
                    api.get('/staff').then((res) => setStaffList(res.data));
                  } catch (error) {
                    toast.error(error.response?.data?.message || 'Failed');
                  }
                }}>
                  <h3>{staffForm._editing ? 'Edit Staff' : 'New Staff Member'}</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Name</label>
                      <input value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Email</label>
                      <input type="email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} required={!staffForm._editing} disabled={staffForm._editing} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>{staffForm._editing ? 'New Password (leave empty to keep)' : 'Password'}</label>
                    <input type="password" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} required={!staffForm._editing} minLength={8} placeholder={staffForm._editing ? 'Leave empty to keep current' : 'Min 8 characters'} />
                  </div>
                  <div className="form-group">
                    <label style={{ marginBottom: '0.75rem' }}>Permissions</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                      {availablePerms.map((perm) => (
                        <label key={perm.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.6rem 0.75rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.85rem', background: staffForm.permissions.includes(perm.id) ? 'rgba(37,99,235,0.04)' : 'transparent', borderColor: staffForm.permissions.includes(perm.id) ? 'var(--copper)' : 'var(--border-light)' }}>
                          <input
                            type="checkbox"
                            checked={staffForm.permissions.includes(perm.id)}
                            onChange={(e) => {
                              const perms = e.target.checked
                                ? [...staffForm.permissions, perm.id]
                                : staffForm.permissions.filter((p) => p !== perm.id);
                              setStaffForm({ ...staffForm, permissions: perms });
                            }}
                            style={{ marginTop: '2px', accentColor: 'var(--copper)' }}
                          />
                          <div>
                            <strong style={{ fontSize: '0.85rem' }}>{perm.label}</strong>
                            <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-light)' }}>{perm.desc}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary">{staffForm._editing ? 'Update' : 'Create'}</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setStaffForm(null)}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            <div className="admin-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Permissions</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 500 }}>{s.name}</td>
                      <td>{s.email}</td>
                      <td>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '100px', background: s.role === 'admin' ? 'rgba(37,99,235,0.1)' : 'rgba(90,138,106,0.1)', color: s.role === 'admin' ? '#2563eb' : 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {s.role}
                        </span>
                      </td>
                      <td style={{ maxWidth: 200 }}>
                        {s.role === 'admin' ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>All access</span>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                            {(s.permissions || []).map((p) => (
                              <span key={p} style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'var(--bg-warm)', color: 'var(--text-secondary)' }}>{p}</span>
                            ))}
                            {(!s.permissions || s.permissions.length === 0) && <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>None</span>}
                          </div>
                        )}
                      </td>
                      <td>
                        {s.role === 'staff' && (
                          <>
                            <button className="icon-btn" onClick={() => setStaffForm({ ...s, password: '', permissions: s.permissions || [], _editing: true, _id: s.id })}>
                              <HiPencil />
                            </button>
                            <button className="icon-btn danger" onClick={async () => {
                              if (!confirm(`Delete staff account "${s.name}"?`)) return;
                              await api.delete(`/staff/${s.id}`);
                              setStaffList(staffList.filter((x) => x.id !== s.id));
                              toast.success('Deleted');
                            }}>
                              <HiTrash />
                            </button>
                          </>
                        )}
                        {s.role === 'admin' && <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
