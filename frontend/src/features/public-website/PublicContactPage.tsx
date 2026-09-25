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
import {
  buildWhatsAppInquiryUrl,
  cleanPhoneNumberForTel,
} from './services/whatsapp.utils';
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
    'https://www.google.com/maps/place/Vahanvati+Gruh+Udhyog+-+Handmade+Papad+in+Padgol/@22.5913772,72.8318268,17z';

  const mapEmbedSrc =
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3683.6717472145788!2d72.8318268!3d22.5913772!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x395e5189455f6d4f%3A0x497aa9c788664c0b!2sVahanvati%20Gruh%20Udhyog%20-%20Handmade%20Papad%20in%20Padgol!5e0!3m2!1sen!2sin!4v1789381688625!5m2!1sen!2sin';

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
                {info?.whatsappEnabled !== false && (
                  <a
                    href={buildWhatsAppInquiryUrl(info?.whatsappNumber, info?.defaultWhatsappMessage)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="public-btn-whatsapp-detail"
                    aria-label="Chat with Vahanvati Gruh Udhyog on WhatsApp"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="22"
                      height="22"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.187-2.59-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.275.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.043.073.043.419-.101.824zM12 2C6.477 2 2 6.477 2 12c0 1.891.524 3.662 1.435 5.176L2 22l4.981-1.309A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.2a8.16 8.16 0 01-4.398-1.272l-.315-.187-2.96.776.79-2.885-.205-.327A8.162 8.162 0 013.8 12c0-4.521 3.679-8.2 8.2-8.2 4.521 0 8.2 3.679 8.2 8.2 0 4.521-3.679 8.2-8.2 8.2z" />
                    </svg>
                    <span>Chat on WhatsApp ({info?.whatsappNumber || '919714917851'})</span>
                  </a>
                )}

                <a
                  href={cleanPhoneNumberForTel(info?.phoneNumber || phone1)}
                  className="public-contact-action-btn call"
                  aria-label="Call Store Primary"
                >
                  <Phone size={20} />
                  <span>Call Primary: {info?.phoneNumber || phone1}</span>
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

      {/* Embedded Google Maps Section */}
      <section style={{ padding: '0 0 4rem 0' }}>
        <div className="public-container">
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.08)',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                padding: '1.5rem 2rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                background: '#fafafa',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: '#eef0f9',
                    color: '#3f438f',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MapPin size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                    Vahanvati Gruh Udhyog - Handmade Papad in Padgol
                  </h3>
                  <div
                    style={{
                      fontSize: '0.9rem',
                      color: '#64748b',
                      marginTop: '0.2rem',
                      fontFamily: 'Noto Sans Gujarati, sans-serif',
                    }}
                  >
                    નડિયાદ - પેટલાદ રોડ, હાઈસ્કૂલની પાસે, પાડગોલ, જિ. આણંદ, ગુજરાત
                  </div>
                </div>
              </div>

              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="public-btn-primary"
                style={{
                  background: '#3f438f',
                  color: '#ffffff',
                  padding: '0.55rem 1.25rem',
                  fontSize: '0.9rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                <Navigation size={16} />
                <span>Open in Google Maps</span>
                <ExternalLink size={14} />
              </a>
            </div>

            <div style={{ width: '100%', height: '480px', position: 'relative' }}>
              <iframe
                src={mapEmbedSrc}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                title="Vahanvati Gruh Udhyog Padgol Location Map"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
