import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HiFilter, HiX } from 'react-icons/hi';
import api from '../api/axios';
import ProductCard from '../components/ProductCard';

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

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
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  return (
    <div className="products-page">
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
                onClick={() => updateFilter('category', '')}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={category === cat ? 'active' : ''}
                  onClick={() => updateFilter('category', cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </aside>

          <div className="products-main">
            {loading ? (
              <div className="loading">Loading...</div>
            ) : products.length === 0 ? (
              <div className="no-products">No products found.</div>
            ) : (
              <>
                <div className="products-grid">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="pagination">
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
    </div>
  );
}
