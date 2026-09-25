import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ShieldCheck,
  Sun,
  CheckCircle2,
  Phone,
  ArrowRight,
  ExternalLink,
  Instagram,
  Youtube,
  Package,
} from 'lucide-react';
import { publicWebsiteApi, PublicHomeData } from './public-website.api';
import { resolveMediaUrl } from '../../services/api/api-client';
import { ProductInquiryButtons } from './components/ProductInquiryButtons';
import { cleanPhoneNumberForTel } from './services/whatsapp.utils';
import './PublicWebsite.css';

// Approved YouTube Videos
const YOUTUBE_VIDEOS = [
  {
    id: 'FrB9KyMpOxQ',
    title: 'Vahanvati Gruh Udhyog Artisanal Video 1',
    embedUrl: 'https://www.youtube.com/embed/FrB9KyMpOxQ',
    watchUrl: 'https://www.youtube.com/watch?v=FrB9KyMpOxQ',
    caption: 'Watch authentic handwoven Sarewada & Sevo production in our Padgol kitchen.',
  },
  {
    id: 'OhGPWtwlDVQ',
    title: 'Vahanvati Gruh Udhyog Artisanal Video 2',
    embedUrl: 'https://www.youtube.com/embed/OhGPWtwlDVQ',
    watchUrl: 'https://www.youtube.com/watch?v=OhGPWtwlDVQ',
    caption: 'Traditional Charotar recipes and sun-drying process walkthrough.',
  },
];

export const PublicHomePage: React.FC = () => {
  const [data, setData] = useState<PublicHomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Vahanvati Gruh Udhyog — Authentic Gujarati Sarewada & Sevo';
    const fetchHomeData = async () => {
      try {
        setLoading(true);
        const homeData = await publicWebsiteApi.getHome();
        setData(homeData);
      } catch (err: any) {
        console.error('Failed to load public home data:', err);
        setError('Unable to load home information right now. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchHomeData();
  }, []);

  const hero = data?.content.hero;
  const highlights = data?.content.highlights || [
    {
      id: '1',
      title: 'Handcrafted Tradition (હાથ વણાટ)',
      description: 'Authentic time-tested recipes handwoven by skilled village artisans.',
      icon: 'Sparkles',
    },
    {
      id: '2',
      title: 'Hygienic Kitchen & Pure Ingredients',
      description: 'No harmful chemicals or artificial preservatives. Pure, clean preparation.',
      icon: 'ShieldCheck',
    },
    {
      id: '3',
      title: 'Traditional Sun-Drying',
      description: 'Naturally sun-cured under clean skies for crisp texture and prolonged shelf life.',
      icon: 'Sun',
    },
    {
      id: '4',
      title: '50+ Artisan Varieties',
      description: 'Extensive variety of Rice, Sabudana, Poha, Rava Sarewada, Sevo, and Vadi.',
      icon: 'CheckCircle2',
    },
  ];

  return (
    <div>
      {/* 1. HERO SECTION */}
      <section className="public-hero">
        <div className="public-container">
          <div className="public-hero-content">
            <div className="public-hero-badge">
              <ShieldCheck size={16} />
              <span>{hero?.badgeText || 'FSSAI Certified: 20720004000511'}</span>
            </div>

            <h1 className="public-hero-headline-en">
              {hero?.headlineEn || 'Authentic Traditional Handcrafted Gujarati Taste'}
            </h1>

            <p className="public-hero-headline-gu">
              {hero?.headlineGu || 'શુદ્ધ અને પૌષ્ટિક હાથ વણાટના સ્વાદિષ્ટ સારેવડા અને સેવો'}
            </p>

            <p className="public-hero-subheadline">
              {hero?.subheadlineEn ||
                'Prepared with time-honored artisanal recipes in Padgol, Gujarat. Premium Sarewada, Sevo, and Vadi crafted with pure ingredients and sun-dried perfection.'}
            </p>

            <div className="public-hero-cta-group">
              <Link to="/products" className="public-btn-primary">
                <span>View Our Products</span>
                <ArrowRight size={18} />
              </Link>
              <Link to="/contact" className="public-btn-secondary">
                <Phone size={18} />
                <span>Contact Store</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. BUSINESS HIGHLIGHTS */}
      <section className="public-section">
        <div className="public-container">
          <div className="public-highlights-grid">
            {highlights.map((h, idx) => (
              <div key={h.id || idx} className="public-highlight-card">
                <div className="public-highlight-icon">
                  {idx === 0 && <Sparkles size={24} />}
                  {idx === 1 && <ShieldCheck size={24} />}
                  {idx === 2 && <Sun size={24} />}
                  {idx === 3 && <CheckCircle2 size={24} />}
                </div>
                <h3 className="public-highlight-title">{h.title}</h3>
                <p className="public-highlight-desc">{h.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. FEATURED PRODUCTS PREVIEW */}
      <section className="public-section public-section-alt">
        <div className="public-container">
          <div className="public-section-header">
            <span className="public-section-badge">Artisanal Specialties</span>
            <h2 className="public-section-title">Our Featured Products</h2>
            <p className="public-section-subtitle">
              Freshly prepared authentic Gujarati varieties. Made strictly with pure grains, natural
              ingredients, and zero artificial preservatives.
            </p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#6b7280' }}>
              Loading products...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#ef4444' }}>
              {error}
            </div>
          ) : data?.featuredProducts && data.featuredProducts.length > 0 ? (
            <div className="public-products-grid">
              {data.featuredProducts.slice(0, 8).map((product) => (
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
                      />
                    </Link>
                    {product.isFeatured && (
                      <span className="public-product-badge">Featured</span>
                    )}
                  </div>

                  <div className="public-product-body">
                    <div className="public-product-category">
                      {product.subcategory?.category?.name || 'Snacks'}
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
                        {product.description.length > 85
                          ? `${product.description.slice(0, 85)}...`
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
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#6b7280' }}>
              No products available at the moment.
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <Link to="/products" className="public-btn-primary" style={{ background: '#3f438f', color: '#ffffff' }}>
              <span>Browse All Products</span>
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* 4. APPROVED YOUTUBE VIDEOS */}
      <section className="public-section">
        <div className="public-container">
          <div className="public-section-header">
            <span className="public-section-badge">Kitchen Craftsmanship</span>
            <h2 className="public-section-title">Watch Our Videos on YouTube</h2>
            <p className="public-section-subtitle">
              Experience the genuine passion, hygiene, and authentic handmade technique behind Vahanvati
              Gruh Udhyog in Padgol.
            </p>
          </div>

          <div className="public-videos-grid">
            {YOUTUBE_VIDEOS.map((video) => (
              <div key={video.id} className="public-video-card">
                <div className="public-video-embed-box">
                  <iframe
                    src={video.embedUrl}
                    title={video.title}
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
                <div className="public-video-card-body">
                  <h3 className="public-video-card-title">{video.title}</h3>
                  <p className="public-video-card-caption">{video.caption}</p>
                  <a
                    href={video.watchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="public-video-fallback-link"
                    aria-label={`Watch ${video.title} directly on YouTube`}
                  >
                    <Youtube size={16} />
                    <span>Watch on YouTube</span>
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
            <Link to="/gallery" className="public-inquire-btn" style={{ padding: '0.65rem 1.25rem', fontSize: '0.95rem' }}>
              <span>View Full Photo & Video Gallery</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* 5. INSTAGRAM SOCIAL SECTION */}
      <section className="public-section public-section-alt">
        <div className="public-container">
          <div className="public-instagram-box">
            <div className="public-instagram-icon-badge">
              <Instagram size={36} />
            </div>
            <h2 className="public-section-title" style={{ marginBottom: '0.5rem' }}>
              Follow Vahanvati Gruh Udhyog on Instagram
            </h2>
            <p className="public-section-subtitle" style={{ maxWidth: '600px', margin: '0 auto 1.5rem auto' }}>
              Stay updated with fresh kitchen batches, festival specials, behind-the-scenes handweaving,
              and customer updates.
            </p>
            <div style={{ marginBottom: '1.75rem', fontWeight: 700, fontSize: '1.2rem', color: '#be185d' }}>
              @vahanvatigruhudhyog
            </div>
            <a
              href="https://www.instagram.com/vahanvatigruhudhyog/"
              target="_blank"
              rel="noopener noreferrer"
              className="public-social-btn instagram"
              style={{ padding: '0.85rem 2rem', fontSize: '1rem', display: 'inline-flex' }}
              aria-label="Follow us on Instagram @vahanvatigruhudhyog"
            >
              <Instagram size={20} />
              <span>Follow on Instagram</span>
              <ExternalLink size={16} />
            </a>
          </div>
        </div>
      </section>

      {/* 6. VISIT STORE CTA */}
      <section className="public-section" style={{ background: '#292d68', color: '#ffffff' }}>
        <div className="public-container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '1rem' }}>
            Visit Our Store in Padgol
          </h2>
          <p style={{ fontSize: '1.1rem', color: '#cbd5e1', maxWidth: '650px', margin: '0 auto 2rem auto' }}>
            હાઈસ્કૂલની પાસે, નડિયાદ - પેટલાદ રોડ, પાડગોલ - ૩૮૮ ૪૪૦, જિ. આણંદ, ગુજરાત.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={cleanPhoneNumberForTel(data?.company?.phone)} className="public-btn-primary">
              <Phone size={18} />
              <span>Call {data?.company?.phone?.split('/')[0]?.trim() || '+91 97149 17851'}</span>
            </a>
            <Link to="/contact" className="public-btn-secondary">
              <span>View Map & Directions</span>
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
