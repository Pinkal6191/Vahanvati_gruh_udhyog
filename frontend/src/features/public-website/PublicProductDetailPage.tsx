import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Phone, Package, ShieldCheck, MapPin, ExternalLink } from 'lucide-react';
import { publicWebsiteApi, PublicProduct } from './public-website.api';
import { resolveMediaUrl } from '../../services/api/api-client';
import './PublicWebsite.css';

export const PublicProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [related, setRelated] = useState<Partial<PublicProduct>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await publicWebsiteApi.getProductDetail(id);
        setProduct(res.product);
        setRelated(res.relatedProducts);
        document.title = `${res.product.name} — Vahanvati Gruh Udhyog`;
      } catch (err: any) {
        console.error('Failed to load product detail:', err);
        setError('Product details are temporarily unavailable.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="public-container" style={{ padding: '6rem 0', textAlign: 'center', color: '#6b7280' }}>
        Loading product details...
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="public-container" style={{ padding: '6rem 0', textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>{error || 'Product Not Found'}</h2>
        <Link to="/products" className="public-btn-primary" style={{ background: '#3f438f', color: '#ffffff' }}>
          <ArrowLeft size={16} />
          <span>Back to Products</span>
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '3rem 0' }}>
      <div className="public-container">
        {/* Breadcrumb Back Link */}
        <div style={{ marginBottom: '2rem' }}>
          <Link
            to="/products"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: '#3f438f',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to All Products</span>
          </Link>
        </div>

        {/* Product Main Showcase */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '3rem',
            background: '#ffffff',
            borderRadius: '16px',
            padding: '2.5rem',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            border: '1px solid #f1f5f9',
          }}
        >
          {/* Left: Image */}
          <div
            style={{
              borderRadius: '12px',
              overflow: 'hidden',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '340px',
            }}
          >
            <img
              src={resolveMediaUrl(product.imageUrl) || '/logo.png'}
              alt={product.name}
              style={{ width: '100%', maxHeight: '420px', objectFit: 'contain' }}
            />
          </div>

          {/* Right: Info */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: '#3f438f', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              {product.subcategory?.category?.name} • {product.subcategory?.name}
            </div>

            <h1 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.35rem', lineHeight: 1.25 }}>
              {product.name}
            </h1>

            {product.gujaratiName && (
              <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#8a3038', fontFamily: 'Noto Sans Gujarati, sans-serif', marginBottom: '1.5rem' }}>
                {product.gujaratiName}
              </div>
            )}

            <div style={{ fontSize: '1rem', lineHeight: 1.7, color: '#475569', marginBottom: '2rem' }}>
              {product.description ||
                'Prepared using traditional recipes in our Padgol kitchen. Sun-cured and handcrafted with highest hygiene standards.'}
            </div>

            {/* Pack Configurations / Base Unit */}
            <div style={{ marginBottom: '2rem', padding: '1.25rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                Available Packaging Sizes:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {product.packConfigurations && product.packConfigurations.length > 0 ? (
                  product.packConfigurations.map((pack) => (
                    <span
                      key={pack.id}
                      style={{
                        padding: '0.35rem 0.75rem',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: '#1e293b',
                      }}
                    >
                      {pack.packName}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.88rem', color: '#64748b' }}>
                    Standard Unit: {product.primaryUnit?.symbol || 'Unit'}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <a
                href="tel:+919714917851"
                className="public-contact-action-btn call"
                style={{ textAlign: 'center', textDecoration: 'none' }}
              >
                <Phone size={18} />
                <span>Call to Inquire / Order: +91 97149 17851</span>
              </a>
              <Link
                to="/contact"
                className="public-contact-action-btn directions"
                style={{ textAlign: 'center', textDecoration: 'none' }}
              >
                <MapPin size={18} />
                <span>Visit Store in Padgol</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {related && related.length > 0 && (
          <div style={{ marginTop: '4rem' }}>
            <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#1e293b', marginBottom: '1.5rem' }}>
              Related Varieties You Might Like
            </h3>
            <div className="public-products-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {related.map((item) => (
                <article key={item.id} className="public-product-card">
                  <div className="public-product-img-box" style={{ height: '150px' }}>
                    <img src={resolveMediaUrl(item.imageUrl) || '/logo.png'} alt={item.name} className="public-product-img" />
                  </div>
                  <div className="public-product-body">
                    <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.2rem' }}>
                      {item.name}
                    </h4>
                    {item.gujaratiName && (
                      <div style={{ fontSize: '0.88rem', color: '#8a3038', fontFamily: 'Noto Sans Gujarati, sans-serif', marginBottom: '0.5rem' }}>
                        {item.gujaratiName}
                      </div>
                    )}
                    <Link to={`/products/${item.id}`} className="public-inquire-btn" style={{ marginTop: 'auto' }}>
                      <span>View Variety</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
