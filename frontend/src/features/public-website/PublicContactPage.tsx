import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Phone,
  Clock,
  Instagram,
  Youtube,
  ExternalLink,
  ShieldCheck,
  Mail,
  Navigation,
} from 'lucide-react';
import { publicWebsiteApi, PublicCompanyInfo } from './public-website.api';
import './PublicWebsite.css';

export const PublicContactPage: React.FC = () => {
  const [info, setInfo] = useState<PublicCompanyInfo | null>(null);

  useEffect(() => {
    document.title = 'Contact & Store Location — Vahanvati Gruh Udhyog';
    const fetchContact = async () => {
      try {
        const contactData = await publicWebsiteApi.getContact();
        setInfo(contactData);
      } catch (err) {
        console.error('Failed to load contact info:', err);
      }
    };

    fetchContact();
  }, []);

  const phone1 = '+91 97149 17851';
  const phone2 = '+91 97121 15118';
  const address =
    info?.address ||
    'હાઈસ્કૂલની પાસે, નડિયાદ - પેટલાદ રોડ, પાડગોલ - ૩૮૮ ૪૪૦, જિ. આણંદ, ગુજરાત.';
  const businessHours = info?.businessHours || 'Monday - Sunday: 8:00 AM - 8:30 PM';
  const mapsUrl =
    info?.googleMapsUrl ||
    'https://www.google.com/maps/search/?api=1&query=Padgol+Nadiad+Petlad+Road+Gujarat';

  return (
    <div>
      {/* Banner */}
      <section style={{ background: 'linear-gradient(135deg, #292d68 0%, #3f438f 100%)', color: '#ffffff', padding: '3.5rem 0' }}>
        <div className="public-container" style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Contact & Store Location</h1>
          <p style={{ fontSize: '1.25rem', color: '#fef08a', fontFamily: 'Noto Sans Gujarati, sans-serif' }}>
            અમારી દુકાનની મુલાકાત લો અથવા સીધો ફોન સંપર્ક કરો
          </p>
        </div>
      </section>

      {/* Main Details Grid */}
      <section className="public-section">
        <div className="public-container">
          <div className="public-contact-grid">
            {/* Left Card: Store Address & Call Actions */}
            <div className="public-contact-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#eef0f9', color: '#3f438f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MapPin size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e293b' }}>
                    Vahanvati Gruh Udhyog Store
                  </h2>
                  <div style={{ fontSize: '0.9rem', color: '#8a3038', fontWeight: 600, fontFamily: 'Noto Sans Gujarati, sans-serif' }}>
                    પાડગોલ, જિ. આણંદ
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Physical Address:</div>
                <p style={{ fontSize: '1.05rem', lineHeight: 1.65, color: '#475569' }}>
                  {address}
                </p>
                <div style={{ fontSize: '0.88rem', color: '#64748b', marginTop: '0.5rem' }}>
                  Landmark: High School Ni Pase (હાઈસ્કૂલની પાસે), Main Nadiad - Petlad Road.
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                <a
                  href="tel:+919714917851"
                  className="public-contact-action-btn call"
                  aria-label="Call +91 97149 17851"
                >
                  <Phone size={20} />
                  <span>Call Primary: {phone1}</span>
                </a>

                <a
                  href="tel:+919712115118"
                  className="public-contact-action-btn"
                  style={{ background: '#292d68', color: '#ffffff', textAlign: 'center' }}
                  aria-label="Call +91 97121 15118"
                >
                  <Phone size={20} />
                  <span>Call Secondary: {phone2}</span>
                </a>

                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="public-contact-action-btn directions"
                  aria-label="Get Directions on Google Maps"
                >
                  <Navigation size={20} />
                  <span>Get Directions on Google Maps</span>
                  <ExternalLink size={16} />
                </a>
              </div>

              {/* Food Licensing & Safety */}
              <div style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <ShieldCheck size={26} style={{ color: '#16a34a', flexShrink: 0 }} />
                <div style={{ fontSize: '0.88rem', color: '#334155' }}>
                  <strong>FSSAI: 20720004000511</strong> • <strong>GSTIN: 24BCIPP6428E1ZL</strong>
                </div>
              </div>
            </div>

            {/* Right Card: Hours & Social Channels */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Business Hours */}
              <div className="public-contact-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={22} />
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b' }}>
                    Business Hours
                  </h3>
                </div>

                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  {businessHours}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Open all 7 days for retail purchase, festive gifting, and NRI inquiries.
                </div>
              </div>

              {/* Official Social Media Channels */}
              <div className="public-contact-card">
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', marginBottom: '1.25rem' }}>
                  Official Social Channels
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Instagram */}
                  <a
                    href="https://www.instagram.com/vahanvatigruhudhyog/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="public-social-btn instagram"
                    style={{ padding: '0.85rem 1.25rem', fontSize: '0.95rem' }}
                    aria-label="Follow us on Instagram @vahanvatigruhudhyog"
                  >
                    <Instagram size={22} />
                    <div>
                      <div style={{ fontWeight: 700 }}>Instagram</div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>@vahanvatigruhudhyog</div>
                    </div>
                    <ExternalLink size={16} style={{ marginLeft: 'auto' }} />
                  </a>

                  {/* YouTube */}
                  <a
                    href="https://www.youtube.com/watch?v=FrB9KyMpOxQ"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="public-social-btn youtube"
                    style={{ padding: '0.85rem 1.25rem', fontSize: '0.95rem' }}
                    aria-label="Watch our videos on YouTube"
                  >
                    <Youtube size={22} />
                    <div>
                      <div style={{ fontWeight: 700 }}>YouTube Channel / Videos</div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Watch Kitchen Handweaving</div>
                    </div>
                    <ExternalLink size={16} style={{ marginLeft: 'auto' }} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
