import React, { useState } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  Phone,
  MapPin,
  Clock,
  Instagram,
  Youtube,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import './PublicLayout.css';

export interface PublicLayoutProps {
  children?: React.ReactNode;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Close mobile drawer on route transition
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="public-site-wrapper">
      {/* Header */}
      <header className="public-header" role="banner">
        <div className="public-header-container">
          {/* Brand Logo */}
          <Link to="/" className="public-brand-link" aria-label="Vahanvati Gruh Udhyog Home">
            <img src="/logo.png" alt="Vahanvati Gruh Udhyog Logo" className="public-brand-logo" />
            <div className="public-brand-text">
              <span className="public-brand-title">Vahanvati Gruh Udhyog</span>
              <span className="public-brand-subtitle">વહાણવટી ગૃહ ઉદ્યોગ</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="public-nav-desktop" aria-label="Main Navigation">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `public-nav-link ${isActive ? 'active' : ''}`}
            >
              Home
            </NavLink>
            <NavLink
              to="/about"
              className={({ isActive }) => `public-nav-link ${isActive ? 'active' : ''}`}
            >
              About
            </NavLink>
            <NavLink
              to="/products"
              className={({ isActive }) => `public-nav-link ${isActive ? 'active' : ''}`}
            >
              Products
            </NavLink>
            <NavLink
              to="/gallery"
              className={({ isActive }) => `public-nav-link ${isActive ? 'active' : ''}`}
            >
              Gallery
            </NavLink>
            <NavLink
              to="/contact"
              className={({ isActive }) => `public-nav-link ${isActive ? 'active' : ''}`}
            >
              Contact
            </NavLink>
          </nav>

          {/* Header Action Button */}
          <div className="public-header-actions">
            <Link to="/contact" className="public-cta-btn">
              <Phone size={16} />
              <span>Contact Us</span>
            </Link>

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              className="public-mobile-toggle"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Close Menu' : 'Open Menu'}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="public-mobile-drawer" role="dialog" aria-modal="true">
            <div
              className="public-mobile-backdrop"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="public-mobile-panel">
              <div className="public-mobile-header">
                <div className="public-brand-text">
                  <span className="public-brand-title">Vahanvati</span>
                  <span className="public-brand-subtitle">ગૃહ ઉદ્યોગ</span>
                </div>
                <button
                  type="button"
                  className="public-mobile-toggle"
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>

              <nav className="public-mobile-links">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `public-mobile-nav-link ${isActive ? 'active' : ''}`
                  }
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Home
                </NavLink>
                <NavLink
                  to="/about"
                  className={({ isActive }) =>
                    `public-mobile-nav-link ${isActive ? 'active' : ''}`
                  }
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  About Us
                </NavLink>
                <NavLink
                  to="/products"
                  className={({ isActive }) =>
                    `public-mobile-nav-link ${isActive ? 'active' : ''}`
                  }
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Our Products
                </NavLink>
                <NavLink
                  to="/gallery"
                  className={({ isActive }) =>
                    `public-mobile-nav-link ${isActive ? 'active' : ''}`
                  }
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Photo & Video Gallery
                </NavLink>
                <NavLink
                  to="/contact"
                  className={({ isActive }) =>
                    `public-mobile-nav-link ${isActive ? 'active' : ''}`
                  }
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Contact & Location
                </NavLink>
              </nav>

              <div style={{ marginTop: 'auto', paddingTop: '1.5rem' }}>
                <a
                  href="tel:+919714917851"
                  className="public-cta-btn"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <Phone size={16} />
                  <span>Call +91 97149 17851</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="public-main" role="main">
        {children || <Outlet />}
      </main>

      {/* Footer */}
      <footer className="public-footer" role="contentinfo">
        <div className="public-footer-container">
          <div className="public-footer-grid">
            {/* Column 1: Brand & Bio */}
            <div>
              <div className="public-footer-brand-title">Vahanvati Gruh Udhyog</div>
              <div className="public-footer-brand-gu">
                હાથ વણાટના સ્પે. સારેવડા તેમજ સેવો તથા વડી બનાવનાર
              </div>
              <p className="public-footer-desc">
                Authentic handcrafted Gujarati Sarewada, Sevo, Papad, and Vadi prepared with traditional
                recipes and hygienic kitchen standards in Padgol, Gujarat.
              </p>
              <div className="public-footer-badges">
                <span className="public-badge-pill">
                  <ShieldCheck size={14} />
                  <span>FSSAI: 20720004000511</span>
                </span>
                <span className="public-badge-pill">
                  <span>GSTIN: 24BCIPP6428E1ZL</span>
                </span>
              </div>
            </div>

            {/* Column 2: Quick Links */}
            <div>
              <h4 className="public-footer-heading">Quick Navigation</h4>
              <ul className="public-footer-links">
                <li>
                  <Link to="/" className="public-footer-link">Home</Link>
                </li>
                <li>
                  <Link to="/about" className="public-footer-link">About Us</Link>
                </li>
                <li>
                  <Link to="/products" className="public-footer-link">Our Products</Link>
                </li>
                <li>
                  <Link to="/gallery" className="public-footer-link">Gallery & Videos</Link>
                </li>
                <li>
                  <Link to="/contact" className="public-footer-link">Contact Store</Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Contact & Hours */}
            <div>
              <h4 className="public-footer-heading">Store Address</h4>
              <div className="public-footer-contact-list">
                <div className="public-contact-item">
                  <MapPin size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#fca5a5' }} />
                  <span>
                    હાઈસ્કૂલની પાસે, નડિયાદ - પેટલાદ રોડ, પાડગોલ - ૩૮૮ ૪૪૦, જિ. આણંદ, ગુજરાત.
                  </span>
                </div>
                <div className="public-contact-item">
                  <Phone size={18} style={{ flexShrink: 0, color: '#93c5fd' }} />
                  <div>
                    <a href="tel:+919714917851">+91 97149 17851</a> /{' '}
                    <a href="tel:+919712115118">+91 97121 15118</a>
                  </div>
                </div>
                <div className="public-contact-item">
                  <Clock size={18} style={{ flexShrink: 0, color: '#86efac' }} />
                  <span>Mon - Sun: 8:00 AM - 8:30 PM</span>
                </div>
              </div>
            </div>

            {/* Column 4: Official Social Presence */}
            <div>
              <h4 className="public-footer-heading">Connect With Us</h4>
              <div className="public-social-btns">
                <a
                  href="https://www.instagram.com/vahanvatigruhudhyog/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="public-social-btn instagram"
                  aria-label="Follow us on Instagram @vahanvatigruhudhyog"
                >
                  <Instagram size={18} />
                  <span>@vahanvatigruhudhyog</span>
                </a>

                <a
                  href="https://www.youtube.com/watch?v=FrB9KyMpOxQ"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="public-social-btn youtube"
                  aria-label="Watch our videos on YouTube"
                >
                  <Youtube size={18} />
                  <span>Watch Our Videos</span>
                </a>
              </div>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="public-footer-bottom">
            <div>
              &copy; {new Date().getFullYear()} Vahanvati Gruh Udhyog. All rights reserved.
            </div>
            <div>
              <Link to="/login" className="public-admin-link">
                <Lock size={13} />
                <span>Staff / Admin Login</span>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
