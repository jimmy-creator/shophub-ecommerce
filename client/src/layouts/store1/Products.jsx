import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HiFilter, HiX } from 'react-icons/hi';
import { Grid2x2, Grid3x3, LayoutList } from 'lucide-react';
import api from '../../api/axios';
import ProductCard from '../../components/ProductCard';
import { SkeletonGrid } from '../../components/Skeleton';
import SEO from '../../components/SEO';

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

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page, category, search, sort, order]);

  const updateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset to page 1 when changing filters, but not when changing page itself
    if (key !== 'page') {
      params.set('page', '1');
    }
    setSearchParams(params);
  };

  return (
    <div className="products-page">
      <SEO
        title={search ? `Search: ${search}` : category || 'All Products'}
        description={`Browse ${category || 'all'} products. Best deals on electronics, clothing, accessories and more.`}
      />
      <div className="container">
        <div className="products-header">
          <h1>{search ? `Search: "${search}"` : category || 'All Products'}</h1>
          <div className="products-controls">
            <select
              value={`${sort}-${order}`}
              onChange={(e) => {
                const [s, o] = e.target.value.split('-');
                updateFilter('sort', s);
                const params = new URLSearchParams(searchParams);
                params.set('order', o);
                params.set('sort', s);
                params.set('page', '1');
                setSearchParams(params);
              }}
            >
              <option value="createdAt-DESC">Newest</option>
              <option value="price-ASC">Price: Low to High</option>
              <option value="price-DESC">Price: High to Low</option>
              <option value="name-ASC">Name: A-Z</option>
            </select>
            <div className="view-toggle">
              <button
                className={viewMode === 'two-col' ? 'active' : ''}
                onClick={() => { setViewMode('two-col'); localStorage.setItem('product-view', 'two-col'); }}
                aria-label="2 columns"
              >
                <Grid2x2 size={16} strokeWidth={1.5} />
              </button>
              <button
                className={viewMode === 'grid' ? 'active' : ''}
                onClick={() => { setViewMode('grid'); localStorage.setItem('product-view', 'grid'); }}
                aria-label="Grid view"
              >
                <Grid3x3 size={16} strokeWidth={1.5} />
              </button>
              <button
                className={viewMode === 'list' ? 'active' : ''}
                onClick={() => { setViewMode('list'); localStorage.setItem('product-view', 'list'); }}
                aria-label="List view"
              >
                <LayoutList size={16} strokeWidth={1.5} />
              </button>
            </div>
            <button className="filter-toggle" onClick={() => setShowFilters(!showFilters)}>
              <HiFilter /> Filters
            </button>
          </div>
        </div>

        <div className="products-layout">
          <aside className={`filters-sidebar ${showFilters ? 'open' : ''}`}>
            <div className="filters-header">
              <h3>Filters</h3>
              <button className="close-filters" onClick={() => setShowFilters(false)}>
                <HiX />
              </button>
            </div>
            <div className="filter-group">
              <h4>Category</h4>
              <button
                className={!category ? 'active' : ''}
                onClick={() => { updateFilter('category', ''); setShowFilters(false); }}
              >
                All
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
            </div>
          </aside>

          <div className="products-main">
            {loading ? (
              <SkeletonGrid count={12} />
            ) : products.length === 0 ? (
              <div className="no-products">No products found.</div>
            ) : (
              <>
                <div className={`products-grid view-${viewMode}`}>
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                {totalPages > 1 && (() => {
                  const WINDOW = 10;
                  const start = Math.min(
                    Math.max(1, page - Math.floor(WINDOW / 2)),
                    Math.max(1, totalPages - WINDOW + 1)
                  );
                  const end = Math.min(totalPages, start + WINDOW - 1);
                  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
                  return (
                    <div className="pagination">
                      <button
                        type="button"
                        onClick={() => updateFilter('page', String(page - 1))}
                        disabled={page === 1}
                        aria-label="Previous page"
                      >
                        ‹
                      </button>
                      {pages.map((n) => (
                        <button
                          key={n}
                          className={page === n ? 'active' : ''}
                          onClick={() => updateFilter('page', String(n))}
                        >
                          {n}
                        </button>
                      ))}
                      <span className="pagination-info">Page {page} of {totalPages}</span>
                      <button
                        type="button"
                        onClick={() => updateFilter('page', String(page + 1))}
                        disabled={page === totalPages}
                        aria-label="Next page"
                      >
                        Next ›
                      </button>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
