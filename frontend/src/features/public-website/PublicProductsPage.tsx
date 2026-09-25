import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Phone, Package, Sparkles, Layers } from 'lucide-react';
import { publicWebsiteApi, PublicProduct, PublicCategory } from './public-website.api';
import { resolveMediaUrl } from '../../services/api/api-client';
import { ProductInquiryButtons } from './components/ProductInquiryButtons';
import { usePublicSettings } from './hooks/usePublicSettings';
import { cleanPhoneNumberForTel } from './services/whatsapp.utils';
import './PublicWebsite.css';

export const PublicProductsPage: React.FC = () => {
  const { settings } = usePublicSettings();
  const telHref = cleanPhoneNumberForTel(settings?.phoneNumber || settings?.phone || '+91 97149 17851');
  const displayPhone = settings?.phoneNumber || settings?.phone || '+91 97149 17851 / +91 97121 15118';

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategory = searchParams.get('category') || '';
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Our Handcrafted Products — Vahanvati Gruh Udhyog';
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

  // Filter out any internal test categories so only genuine product categories are displayed
  const displayCategories = useMemo(() => {
    return categories.filter((c) => {
      const isTestPattern =
        /\b(1790\d+|1788\d+|cat_\d+|invc_\d+|sc_\d+)\b/i.test(c.code) ||
        /\b1790\d+\b/.test(c.name) ||
        /^(cat|inv cat|sec category|bill cat|ca cat)\s*\d+/i.test(c.name);
      return !isTestPattern;
    });
  }, [categories]);

  // Group products category-wise
  const categoryGroups = useMemo(() => {
    if (selectedCategory) {
      const activeCat = displayCategories.find((c) => c.id === selectedCategory);
      return [
        {
          categoryId: selectedCategory,
          categoryName: activeCat?.name || 'Selected Category',
          products: products,
        },
      ];
    }

    const groupsMap = new Map<string, { categoryId: string; categoryName: string; products: PublicProduct[] }>();

    // Pre-populate with known categories in order
    displayCategories.forEach((cat) => {
      groupsMap.set(cat.id, {
        categoryId: cat.id,
        categoryName: cat.name,
        products: [],
      });
    });

    // Populate products
    products.forEach((prod) => {
      const catId = prod.subcategory?.category?.id || 'other';
      const catName = prod.subcategory?.category?.name || 'Other Traditional Delicacies';

      if (!groupsMap.has(catId)) {
        groupsMap.set(catId, {
          categoryId: catId,
          categoryName: catName,
          products: [],
        });
      }
      groupsMap.get(catId)!.products.push(prod);
    });

    // Filter out empty categories
    return Array.from(groupsMap.values()).filter((g) => g.products.length > 0);
  }, [products, displayCategories, selectedCategory]);

  return (
    <div>
      {/* Banner */}
      <section
        style={{
          background: 'linear-gradient(135deg, #292d68 0%, #3f438f 100%)',
          color: '#ffffff',
          padding: '3.5rem 0',
        }}
      >
        <div className="public-container" style={{ textAlign: 'center' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 1rem',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.15)',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '0.75rem',
              letterSpacing: '0.04em',
            }}
          >
            <Sparkles size={14} color="#fef08a" />
            <span>AUTHENTIC HANDMADE GUJARATI VARIETIES</span>
          </span>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            Our Handcrafted Product Catalog
          </h1>
          <p
            style={{
              fontSize: '1.25rem',
              color: '#fef08a',
              fontFamily: 'Noto Sans Gujarati, sans-serif',
            }}
          >
            શુદ્ધ સામગ્રીમાંથી પરંપરાગત રીતે બનાવેલા સ્વાદિષ્ટ સારેવડા, પાપડ, સેવો અને વડી
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
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af',
                }}
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

            {/* Category Pills Navigation */}
            <div>
              <div
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#64748b',
                  letterSpacing: '0.05em',
                  marginBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <Layers size={14} />
                <span>Categories (કેટેગરી મુજબ જુઓ):</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => handleCategorySelect('')}
                  style={{
                    padding: '0.45rem 1.1rem',
                    borderRadius: '9999px',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: !selectedCategory ? '#3f438f' : '#f1f5f9',
                    color: !selectedCategory ? '#ffffff' : '#475569',
                    boxShadow: !selectedCategory ? '0 2px 8px rgba(63, 67, 143, 0.25)' : 'none',
                  }}
                >
                  All Categories ({products.length})
                </button>

                {displayCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategorySelect(cat.id)}
                    style={{
                      padding: '0.45rem 1.1rem',
                      borderRadius: '9999px',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: selectedCategory === cat.id ? '#3f438f' : '#f1f5f9',
                      color: selectedCategory === cat.id ? '#ffffff' : '#475569',
                      boxShadow:
                        selectedCategory === cat.id ? '0 2px 8px rgba(63, 67, 143, 0.25)' : 'none',
                    }}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Category-Wise Product Sections */}
      <section className="public-section" style={{ minHeight: '400px' }}>
        <div className="public-container">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '5rem 0', color: '#6b7280' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  border: '3px solid #e2e8f0',
                  borderTopColor: '#3f438f',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 1rem auto',
                }}
              />
              Loading handcrafted products...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#ef4444' }}>
              {error}
            </div>
          ) : categoryGroups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '5rem 0', color: '#6b7280' }}>
              <Package size={52} style={{ margin: '0 auto 1rem auto', color: '#cbd5e1' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
                No products found
              </h3>
              <p style={{ marginTop: '0.5rem' }}>
                Try clearing your search query or selecting another category.
              </p>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => handleCategorySelect('')}
                  className="public-btn-primary"
                  style={{
                    background: '#3f438f',
                    color: '#ffffff',
                    marginTop: '1.5rem',
                    display: 'inline-flex',
                  }}
                >
                  View All Products
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3.5rem' }}>
              {categoryGroups.map((group) => (
                <div key={group.categoryId} className="public-category-group">
                  {/* Category Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      borderBottom: '2px solid #e2e8f0',
                      paddingBottom: '0.75rem',
                      marginBottom: '1.75rem',
                    }}
                  >
                    <div>
                      <h2
                        style={{
                          fontSize: '1.65rem',
                          fontWeight: 800,
                          color: '#1e293b',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <span>{group.categoryName}</span>
                      </h2>
                    </div>
                    <span
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: '#64748b',
                        background: '#f1f5f9',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                      }}
                    >
                      {group.products.length} {group.products.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  {/* Products Grid for this Category */}
                  <div className="public-products-grid">
                    {group.products.map((product) => (
                      <article key={product.id} className="public-product-card">
                        <div className="public-product-img-box">
                          <Link
                            to={`/products/${product.id}`}
                            className="public-product-img-link"
                            title={`View details of ${product.name}`}
                          >
                            <img
                              src={resolveMediaUrl(product.imageUrl) || '/logo.png'}
                              alt={product.name}
                              className="public-product-img"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/logo.png';
                              }}
                            />
                          </Link>
                          {product.isFeatured && (
                            <span className="public-product-badge">Featured</span>
                          )}
                        </div>

                        <div className="public-product-body">
                          <div className="public-product-category">
                            {product.subcategory?.name || group.categoryName}
                          </div>
                          <h3 className="public-product-name">
                            <Link
                              to={`/products/${product.id}`}
                              className="public-product-title-link"
                              title={`View details of ${product.name}`}
                            >
                              {product.name}
                            </Link>
                          </h3>
                          {product.gujaratiName && (
                            <div className="public-product-gu-name">{product.gujaratiName}</div>
                          )}
                          {product.description && (
                            <p className="public-product-desc">
                              {product.description.length > 95
                                ? `${product.description.slice(0, 95)}...`
                                : product.description}
                            </p>
                          )}

                          <div className="public-product-footer">
                            <ProductInquiryButtons product={product} layout="card" />
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Inquiry Banner */}
      <section style={{ background: '#f8fafc', padding: '3rem 0', borderTop: '1px solid #e2e8f0' }}>
        <div className="public-container" style={{ textAlign: 'center' }}>
          <h3
            style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              color: '#1e293b',
              marginBottom: '0.5rem',
            }}
          >
            Looking for festive bulk orders or retail packs?
          </h3>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
            Call us directly or visit our store in Padgol for fresh, authentic batches.
          </p>
          <a
            href={telHref}
            className="public-btn-primary"
            style={{ background: '#3f438f', color: '#ffffff' }}
          >
            <Phone size={18} />
            <span>Call {displayPhone}</span>
          </a>
        </div>
      </section>
    </div>
  );
};
