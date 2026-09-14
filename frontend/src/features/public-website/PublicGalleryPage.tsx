import React, { useEffect, useState } from 'react';
import { Youtube, Image as ImageIcon, ExternalLink, X, Play } from 'lucide-react';
import { publicWebsiteApi, PublicGalleryItem } from './public-website.api';
import './PublicWebsite.css';

// Approved YouTube Videos with direct watch links and 16:9 embed links
const APPROVED_YOUTUBE_VIDEOS = [
  {
    id: 'FrB9KyMpOxQ',
    title: 'Vahanvati Gruh Udhyog Artisanal Video 1',
    embedUrl: 'https://www.youtube.com/embed/FrB9KyMpOxQ',
    watchUrl: 'https://www.youtube.com/watch?v=FrB9KyMpOxQ',
    caption: 'Traditional handmade Sarewada and Sevo preparation in our Padgol kitchen facility.',
  },
  {
    id: 'OhGPWtwlDVQ',
    title: 'Vahanvati Gruh Udhyog Artisanal Video 2',
    embedUrl: 'https://www.youtube.com/embed/OhGPWtwlDVQ',
    watchUrl: 'https://www.youtube.com/watch?v=OhGPWtwlDVQ',
    caption: 'Special handwoven Sarewada technique and natural sun-curing process.',
  },
];

export const PublicGalleryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'PHOTOS' | 'VIDEOS'>('ALL');
  const [galleryItems, setGalleryItems] = useState<PublicGalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState<PublicGalleryItem | null>(null);

  useEffect(() => {
    document.title = 'Photo & Video Gallery — Vahanvati Gruh Udhyog';
    const fetchGallery = async () => {
      try {
        setLoading(true);
        const res = await publicWebsiteApi.getGallery();
        setGalleryItems(res.items);
      } catch (err) {
        console.error('Failed to load gallery:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchGallery();
  }, []);

  // Keyboard escape listener for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivePhoto(null);
      }
    };

    if (activePhoto) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePhoto]);

  const photos = galleryItems.filter((item) => item.mediaType === 'IMAGE');

  return (
    <div>
      {/* Banner */}
      <section style={{ background: 'linear-gradient(135deg, #292d68 0%, #3f438f 100%)', color: '#ffffff', padding: '3.5rem 0' }}>
        <div className="public-container" style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Photo & Video Gallery</h1>
          <p style={{ fontSize: '1.25rem', color: '#fef08a', fontFamily: 'Noto Sans Gujarati, sans-serif' }}>
            અમારી કિચન તૈયારી, પરંપરાગત વણાટ અને વીડિયો ઝલક
          </p>
        </div>
      </section>

      {/* Tabs */}
      <section style={{ padding: '1.5rem 0', background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        <div className="public-container">
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              style={{
                padding: '0.55rem 1.25rem',
                borderRadius: '9999px',
                fontWeight: 600,
                fontSize: '0.92rem',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: activeTab === 'ALL' ? '#3f438f' : '#f1f5f9',
                color: activeTab === 'ALL' ? '#ffffff' : '#475569',
              }}
            >
              All Media
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('VIDEOS')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.55rem 1.25rem',
                borderRadius: '9999px',
                fontWeight: 600,
                fontSize: '0.92rem',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: activeTab === 'VIDEOS' ? '#3f438f' : '#f1f5f9',
                color: activeTab === 'VIDEOS' ? '#ffffff' : '#475569',
              }}
            >
              <Youtube size={16} />
              <span>YouTube Videos</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PHOTOS')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.55rem 1.25rem',
                borderRadius: '9999px',
                fontWeight: 600,
                fontSize: '0.92rem',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: activeTab === 'PHOTOS' ? '#3f438f' : '#f1f5f9',
                color: activeTab === 'PHOTOS' ? '#ffffff' : '#475569',
              }}
            >
              <ImageIcon size={16} />
              <span>Photos</span>
            </button>
          </div>
        </div>
      </section>

      {/* Media Grid */}
      <section className="public-section">
        <div className="public-container">
          {/* 1. VIDEOS SECTION */}
          {(activeTab === 'ALL' || activeTab === 'VIDEOS') && (
            <div style={{ marginBottom: activeTab === 'ALL' ? '4rem' : '0' }}>
              <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#292d68', marginBottom: '0.5rem' }}>
                  Featured YouTube Videos
                </h2>
                <p style={{ color: '#64748b' }}>
                  Authentic kitchen footage and production walkthrough from our Padgol facility.
                </p>
              </div>

              <div className="public-videos-grid">
                {APPROVED_YOUTUBE_VIDEOS.map((video) => (
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
                        aria-label={`Watch ${video.title} on YouTube`}
                      >
                        <Youtube size={16} />
                        <span>Watch on YouTube</span>
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. PHOTOS SECTION */}
          {(activeTab === 'ALL' || activeTab === 'PHOTOS') && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#292d68', marginBottom: '0.5rem' }}>
                  Photo Gallery
                </h2>
                <p style={{ color: '#64748b' }}>
                  Artisanal preparation, sun-curing racks, and packaging standards.
                </p>
              </div>

              {photos.length > 0 ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '1.5rem',
                  }}
                >
                  {photos.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setActivePhoto(item)}
                      style={{
                        background: '#ffffff',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        border: '1px solid #e5e7eb',
                        cursor: 'pointer',
                        transition: 'all 0.25s ease',
                      }}
                    >
                      <div style={{ height: '220px', background: '#f8fafc', overflow: 'hidden' }}>
                        <img
                          src={item.mediaUrl}
                          alt={item.title || 'Vahanvati Gallery Item'}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          loading="lazy"
                        />
                      </div>
                      {item.title && (
                        <div style={{ padding: '1rem' }}>
                          <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                            {item.title}
                          </h4>
                          {item.caption && (
                            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                              {item.caption}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: '#6b7280' }}>
                  Gallery photos coming soon.
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Lightbox Modal */}
      {activePhoto && (
        <div
          className="public-lightbox-overlay"
          onClick={() => setActivePhoto(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="public-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="public-lightbox-close"
              onClick={() => setActivePhoto(null)}
              aria-label="Close Lightbox"
            >
              <X size={28} />
            </button>
            <img src={activePhoto.mediaUrl} alt={activePhoto.title || 'Vahanvati'} className="public-lightbox-img" />
            {activePhoto.title && (
              <div className="public-lightbox-caption">
                <strong>{activePhoto.title}</strong>
                {activePhoto.caption && <p style={{ marginTop: '0.25rem' }}>{activePhoto.caption}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
