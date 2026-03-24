import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { HiPlus, HiPencil, HiTrash, HiPhotograph, HiX } from 'react-icons/hi';
import ProductImage from '../components/ProductImage';

const emptyProduct = {
  name: '', description: '', price: '', comparePrice: '',
  category: '', brand: '', stock: '', featured: false, images: [],
};

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
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (tab === 'products') {
      api.get('/products?limit=100').then((res) => setProducts(res.data.products));
    } else {
      api.get('/orders/all?limit=50').then((res) => setOrders(res.data.orders));
    }
  }, [tab]);

  if (user?.role !== 'admin') {
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
      const res = await api.get('/products?limit=100');
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
          <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>
            Products
          </button>
          <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>
            Orders
          </button>
        </div>

        {tab === 'products' && (
          <div>
            <button
              className="btn btn-primary"
              onClick={() => { setShowForm(true); setEditing(null); setForm(emptyProduct); }}
              style={{ marginBottom: '1.5rem' }}
            >
              <HiPlus /> Add Product
            </button>

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
                          <option value="Electronics">Electronics</option>
                          <option value="Clothing">Clothing</option>
                          <option value="Footwear">Footwear</option>
                          <option value="Accessories">Accessories</option>
                          <option value="Sports">Sports</option>
                          <option value="Home">Home</option>
                          <option value="Beauty">Beauty</option>
                          <option value="Food">Food</option>
                          <option value="Books">Books</option>
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
                  </div>

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
                      <td>₹{parseFloat(p.price).toFixed(2)}</td>
                      <td>{p.stock}</td>
                      <td>{p.featured ? 'Yes' : 'No'}</td>
                      <td>
                        <button
                          className="icon-btn"
                          onClick={() => {
                            setForm({ ...p, images: p.images || [] });
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
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.orderNumber}</td>
                    <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td>₹{parseFloat(o.totalAmount).toFixed(2)}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
