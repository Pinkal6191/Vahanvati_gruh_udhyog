import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, HeartHandshake, Award, Sparkles, MapPin, Phone, ArrowRight } from 'lucide-react';
import { publicWebsiteApi, PublicAboutData } from './public-website.api';
import './PublicWebsite.css';

export const PublicAboutPage: React.FC = () => {
  const [data, setData] = useState<PublicAboutData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'About Us — Vahanvati Gruh Udhyog';
    const fetchAbout = async () => {
      try {
        setLoading(true);
        const aboutData = await publicWebsiteApi.getAbout();
        setData(aboutData);
      } catch (err) {
        console.error('Failed to load about data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAbout();
  }, []);

  const story = data?.content.story;
  const values = data?.content.values || [
    {
      title: 'Purity & Honesty',
      description: 'Using only the finest grains, pulses, and traditional spices with zero adulteration.',
    },
    {
      title: 'Artisanal Preservation',
      description: 'Keeping alive the authentic hand-spun Sarewada techniques unique to Charotar.',
    },
    {
      title: 'Customer Trust',
      description: 'Serving thousands of local families, NRI patrons, and festive celebrations with consistent delight.',
    },
  ];

  return (
    <div>
      {/* Banner */}
      <section style={{ background: 'linear-gradient(135deg, #292d68 0%, #3f438f 100%)', color: '#ffffff', padding: '4rem 0' }}>
        <div className="public-container" style={{ textAlign: 'center' }}>
          <span className="public-hero-badge" style={{ marginBottom: '1rem' }}>
            <Award size={16} />
            <span>Artisanal Heritage Since Generations</span>
          </span>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>About Vahanvati Gruh Udhyog</h1>
          <p style={{ fontSize: '1.25rem', color: '#fef08a', fontFamily: 'Noto Sans Gujarati, sans-serif' }}>
            વહાણવટી ગૃહ ઉદ્યોગ — સ્વાદ અને પરંપરાની સફર
          </p>
        </div>
      </section>

      {/* Main Story */}
      <section className="public-section">
        <div className="public-container">
          <div style={{ maxWidth: '820px', margin: '0 auto' }}>
            <div style={{ background: '#ffffff', padding: '3rem', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <img src="/logo.png" alt="Vahanvati" style={{ width: '64px', height: '64px', borderRadius: '12px' }} />
                <div>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#292d68', marginBottom: '0.2rem' }}>
                    {story?.title || 'The Story of Vahanvati Gruh Udhyog'}
                  </h2>
                  <div style={{ fontSize: '1.05rem', color: '#8a3038', fontWeight: 600, fontFamily: 'Noto Sans Gujarati, sans-serif' }}>
                    {story?.titleGu || 'હાથ વણાટના સારેવડા, પાપડ અને સેવોના નિષ્ણાત'}
                  </div>
                </div>
              </div>

              {story?.paragraphs ? (
                story.paragraphs.map((p, idx) => (
                  <p key={idx} style={{ fontSize: '1.05rem', lineHeight: 1.75, color: '#374151', marginBottom: '1.25rem' }}>
                    {p}
                  </p>
                ))
              ) : (
                <>
                  <p style={{ fontSize: '1.05rem', lineHeight: 1.75, color: '#374151', marginBottom: '1.25rem' }}>
                    Rooted in the heart of Padgol along the Nadiad-Petlad Road in Anand, Gujarat, Vahanvati Gruh Udhyog
                    was established with a singular vision: to bring the authentic, nostalgic taste of homemade Gujarati
                    Sarewada, Sevo, and Vadi to every household.
                  </p>
                  <p style={{ fontSize: '1.05rem', lineHeight: 1.75, color: '#374151', marginBottom: '1.25rem' }}>
                    Our specialty lies in our signature "હાથ વણાટ" (hand-weaving) technique. Unlike industrial mass-produced snacks,
                    our products are crafted by skilled local women and artisans who have inherited these culinary arts across generations.
                  </p>
                  <p style={{ fontSize: '1.05rem', lineHeight: 1.75, color: '#374151', marginBottom: '1.25rem' }}>
                    We combine natural ingredients, pure drinking water, natural spices, and the abundant Gujarat sunshine for traditional curing.
                    Certified under FSSAI license 20720004000511, our production kitchen adheres strictly to cleanliness, purity, and uncompromising food safety standards.
                  </p>
                </>
              )}

              {/* FSSAI Badge Card */}
              <div style={{ marginTop: '2.5rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '1rem' }}>
                    FSSAI License: 20720004000511 • GSTIN: 24BCIPP6428E1ZL
                  </div>
                  <div style={{ fontSize: '0.88rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Licensed food manufacturing facility adhering to hygiene, clean processing, and certified food safety.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="public-section public-section-alt">
        <div className="public-container">
          <div className="public-section-header">
            <span className="public-section-badge">Our Principles</span>
            <h2 className="public-section-title">What Defines Our Quality</h2>
            <p className="public-section-subtitle">
              The foundational pillars that guide every batch prepared in our kitchen.
            </p>
          </div>

          <div className="public-highlights-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {values.map((v, idx) => (
              <div key={idx} className="public-highlight-card">
                <div className="public-highlight-icon">
                  {idx === 0 && <Sparkles size={24} />}
                  {idx === 1 && <HeartHandshake size={24} />}
                  {idx === 2 && <Award size={24} />}
                </div>
                <h3 className="public-highlight-title">{v.title}</h3>
                <p className="public-highlight-desc">{v.description}</p>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '3.5rem' }}>
            <Link to="/products" className="public-btn-primary" style={{ background: '#3f438f', color: '#ffffff' }}>
              <span>Explore Our Varieties</span>
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
