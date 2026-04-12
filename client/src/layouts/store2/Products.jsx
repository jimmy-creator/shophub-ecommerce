import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Filter, X, LayoutGrid, Grid2x2, List } from 'lucide-react';
import api from '../../api/axios';
import SEO from '../../components/SEO';
import ProductCard from './ProductCard';

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('product-view') || 'grid');

  const page = parseInt(searchParams.get('page') || '1');
  const category = searchParams.get('category') || '';
  const search = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || 'createdAt';
  const order = searchParams.get('order') || 'DESC';

  useEffect(() => {
    api.get('/products/categories').then((res) => setCategories(res.data));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { page, limit: 12, sort, order };
    if (category) params.category = category;
    if (search) params.search = search;

    api.get('/products', { params })
      .then((res) => {
        setProducts(res.data.products);
        setTotalPages(res.data.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, category, search, sort, order]);

  const updateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== 'page') params.set('page', '1');
    setSearchParams(params);
  };

  const title = search ? `"${search}"` : category || 'Everything';

  return (
    <div className="s2-root">
      <SEO
        title={search ? `Search: ${search}` : category || 'All Products'}
        description={`Browse ${category || 'all'} products in the atrium.`}
      />

      <div className="s2-page-head">
        <div>
          <p className="s2-eyebrow" style={{ marginBottom: '0.75rem' }}>
            {search ? 'Searching for' : 'Collection'}
          </p>
          <h1 className="s2-page-title">
            <em>{title}</em>
          </h1>
        </div>

        <div className="s2-controls">
          <select
            className="s2-select"
            value={`${sort}-${order}`}
            onChange={(e) => {
              const [s, o] = e.target.value.split('-');
              const p = new URLSearchParams(searchParams);
              p.set('sort', s);
              p.set('order', o);
              p.set('page', '1');
              setSearchParams(p);
            }}
          >
            <option value="createdAt-DESC">Newest first</option>
            <option value="price-ASC">Price · low to high</option>
            <option value="price-DESC">Price · high to low</option>
            <option value="name-ASC">Name · A–Z</option>
          </select>
          <div className="s2-view-toggle">
            <button
              className={viewMode === 'two-col' ? 'active' : ''}
              onClick={() => { setViewMode('two-col'); localStorage.setItem('product-view', 'two-col'); }}
              aria-label="Two columns"
            >
              <Grid2x2 size={15} strokeWidth={1.7} />
            </button>
            <button
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => { setViewMode('grid'); localStorage.setItem('product-view', 'grid'); }}
              aria-label="Grid"
            >
              <LayoutGrid size={15} strokeWidth={1.7} />
            </button>
            <button
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => { setViewMode('list'); localStorage.setItem('product-view', 'list'); }}
              aria-label="List"
            >
              <List size={15} strokeWidth={1.7} />
            </button>
          </div>
          <button type="button" className="s2-filter-toggle" onClick={() => setShowFilters(true)}>
            <Filter size={14} strokeWidth={1.8} /> Filters
          </button>
        </div>
      </div>

      <div className="s2-products-layout">
        <aside className={`s2-filters ${showFilters ? 'open' : ''}`}>
          <button
            type="button"
            className="s2-filters-close"
            onClick={() => setShowFilters(false)}
            aria-label="Close filters"
          >
            <X size={16} strokeWidth={1.8} />
          </button>
          <h3>Filters</h3>

          <h4>Category</h4>
          <button
            className={!category ? 'active' : ''}
            onClick={() => { updateFilter('category', ''); setShowFilters(false); }}
          >
            All rooms
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={category === cat ? 'active' : ''}
              onClick={() => { updateFilter('category', cat); setShowFilters(false); }}
            >
              {cat}
            </button>
          ))}
        </aside>

        <div>
          {loading ? (
            <div className="s2-grid">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="s2-product" style={{ aspectRatio: '0.72' }} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="s2-no-products">
              Nothing in this room tonight.
            </div>
          ) : (
            <>
              <div className="s2-grid">
                {products.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
              {totalPages > 1 && (
                <div className="s2-pagination">
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i + 1}
                      className={page === i + 1 ? 'active' : ''}
                      onClick={() => updateFilter('page', String(i + 1))}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

