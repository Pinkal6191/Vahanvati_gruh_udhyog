import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Filter, Phone, ArrowRight, Package } from 'lucide-react';
import { publicWebsiteApi, PublicProduct, PublicCategory } from './public-website.api';
import './PublicWebsite.css';

export const PublicProductsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategory = searchParams.get('category') || '';
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Our Products — Vahanvati Gruh Udhyog';
  }, []);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await publicWebsiteApi.getProducts({
          search: search || undefined,
          categoryId: selectedCategory || undefined,
        });
        setProducts(res.products);
        setCategories(res.categories);
      } catch (err) {
        console.error('Failed to load public catalog:', err);
        setError('Products are temporarily unavailable. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, [selectedCategory, search]);

  const handleCategorySelect = (catId: string) => {
    if (catId) {
      setSearchParams({ category: catId });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div>
      {/* Banner */}
      <section style={{ background: 'linear-gradient(135deg, #292d68 0%, #3f438f 100%)', color: '#ffffff', padding: '3.5rem 0' }}>
        <div className="public-container" style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Our Handcrafted Products</h1>
          <p style={{ fontSize: '1.25rem', color: '#fef08a', fontFamily: 'Noto Sans Gujarati, sans-serif' }}>
            શુદ્ધ સામગ્રીમાંથી પરંપરાગત રીતે બનાવેલા સ્વાદિષ્ટ સારેવડા, પાપડ અને સેવો
          </p>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <section style={{ padding: '2rem 0', background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        <div className="public-container">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', maxWidth: '480px' }}>
              <Search
                size={18}
                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}
              />
              <input
                type="text"
                placeholder="Search products in English or ગુજરાતી..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 1rem 0.65rem 2.6rem',
                  borderRadius: '10px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.95rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Category Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => handleCategorySelect('')}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '9999px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: !selectedCategory ? '#3f438f' : '#f1f5f9',
                  color: !selectedCategory ? '#ffffff' : '#475569',
                }}
              >
                All Varieties ({products.length})
              </button>

              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategorySelect(cat.id)}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '9999px',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: selectedCategory === cat.id ? '#3f438f' : '#f1f5f9',
                    color: selectedCategory === cat.id ? '#ffffff' : '#475569',
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="public-section">
        <div className="public-container">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: '#6b7280' }}>
              Loading handcrafted products...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#ef4444' }}>
              {error}
            </div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: '#6b7280' }}>
              <Package size={48} style={{ margin: '0 auto 1rem auto', color: '#cbd5e1' }} />
              <h3>No products available at the moment.</h3>
              <p style={{ marginTop: '0.5rem' }}>Try changing the search or category filter.</p>
            </div>
          ) : (
            <div className="public-products-grid">
              {products.map((product) => (
                <article key={product.id} className="public-product-card">
                  <div className="public-product-img-box">
                    <img
                      src={product.imageUrl || '/logo.png'}
                      alt={product.name}
                      className="public-product-img"
                      loading="lazy"
                    />
                    {product.isFeatured && (
                      <span className="public-product-badge">Featured</span>
                    )}
                  </div>

                  <div className="public-product-body">
                    <div className="public-product-category">
                      {product.subcategory?.category?.name || 'Snacks'}
                    </div>
                    <h3 className="public-product-name">{product.name}</h3>
                    {product.gujaratiName && (
                      <div className="public-product-gu-name">{product.gujaratiName}</div>
                    )}
                    {product.description && (
                      <p className="public-product-desc">
                        {product.description.length > 90
                          ? `${product.description.slice(0, 90)}...`
                          : product.description}
                      </p>
                    )}

                    <div className="public-product-footer">
                      <span className="public-product-pack-tag">
                        Standard Unit: {product.primaryUnit?.symbol || 'Unit'}
                      </span>
                      <Link to={`/products/${product.id}`} className="public-inquire-btn">
                        <span>Details</span>
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Inquiry Banner */}
      <section style={{ background: '#f8fafc', padding: '3rem 0', borderTop: '1px solid #e2e8f0' }}>
        <div className="public-container" style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>
            Want to inquire about bulk festive orders or retail availability?
          </h3>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
            Direct call or visit our Padgol store for fresh batches and authentic taste.
          </p>
          <a href="tel:+919714917851" className="public-btn-primary" style={{ background: '#3f438f', color: '#ffffff' }}>
            <Phone size={18} />
            <span>Call +91 97149 17851 / +91 97121 15118</span>
          </a>
        </div>
      </section>
    </div>
  );
};
