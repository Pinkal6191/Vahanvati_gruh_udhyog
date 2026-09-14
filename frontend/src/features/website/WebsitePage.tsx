import React, { useEffect, useState } from 'react';
import {
  Globe,
  ExternalLink,
  Save,
  Home,
  FileText,
  Package,
  Image as ImageIcon,
  Phone,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Star,
  RefreshCw,
  Search,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Button } from '../../components/ui/Button/Button';
import { LoadingState } from '../../components/common/LoadingState/LoadingState';
import { websiteCmsApi, CmsProduct, CmsGalleryItem } from './website-cms.api';
import './WebsitePage.css';

type CmsTab = 'HOME' | 'ABOUT' | 'PRODUCTS' | 'GALLERY' | 'CONTACT';

export const WebsitePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CmsTab>('HOME');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // CMS Form States
  const [homeContent, setHomeContent] = useState<any>({
    hero: {
      headlineEn: 'Authentic Traditional Handcrafted Gujarati Taste',
      headlineGu: 'શુદ્ધ અને પૌષ્ટિક હાથ વણાટના સ્વાદિષ્ટ સારેવડા અને સેવો',
      subheadlineEn:
        'Prepared with time-honored artisanal recipes in Padgol, Gujarat. Premium Sarewada, Sevo, and Vadi crafted with pure ingredients and sun-dried perfection.',
      badgeText: 'FSSAI Certified: 20720004000511',
    },
    announcement: '',
  });

  const [aboutContent, setAboutContent] = useState<any>({
    story: {
      title: 'The Story of Vahanvati Gruh Udhyog',
      titleGu: 'વહાણવટી ગૃહ ઉદ્યોગ — સ્વાદ અને પરંપરાની સફર',
      paragraphs: [
        'Rooted in the heart of Padgol along the Nadiad-Petlad Road in Anand, Gujarat, Vahanvati Gruh Udhyog was established with a singular vision: to bring the authentic, nostalgic taste of homemade Gujarati Sarewada, Sevo, and Vadi to every household.',
        'Our specialty lies in our signature "હાથ વણાટ" (hand-weaving) technique. Unlike industrial mass-produced snacks, our products are crafted by skilled local women and artisans who have inherited these culinary arts across generations.',
        'We combine natural ingredients, pure drinking water, natural spices, and the abundant Gujarat sunshine for traditional curing. Certified under FSSAI license 20720004000511, our production kitchen adheres strictly to cleanliness, purity, and uncompromising food safety standards.',
      ],
    },
  });

  const [products, setProducts] = useState<CmsProduct[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [galleryItems, setGalleryItems] = useState<CmsGalleryItem[]>([]);

  // New Media Item Form
  const [newMedia, setNewMedia] = useState({
    title: '',
    caption: '',
    mediaType: 'IMAGE' as 'IMAGE' | 'VIDEO',
    mediaUrl: '',
    displayOrder: 0,
    isVisible: true,
  });
  const [showAddMedia, setShowAddMedia] = useState(false);

  // Contact Settings
  const [contactSettings, setContactSettings] = useState({
    address: 'હાઈસ્કૂલની પાસે, નડિયાદ - પેટલાદ રોડ, પાડગોલ - ૩૮૮ ૪૪૦',
    phone: '+91 97149 17851 / +91 97121 15118',
    email: 'info@vahanvati.com',
    businessHours: 'Monday - Sunday: 8:00 AM - 8:30 PM',
    googleMapsUrl: 'https://maps.google.com/?q=Padgol+Gujarat',
    instagramUrl: 'https://www.instagram.com/vahanvatigruhudhyog/',
    youtubeUrl: 'https://www.youtube.com/watch?v=FrB9KyMpOxQ',
  });

  useEffect(() => {
    loadAllCmsData();
  }, []);

  const loadAllCmsData = async () => {
    try {
      setLoading(true);
      const [homeData, aboutData, prods, gallery] = await Promise.all([
        websiteCmsApi.getContent('home').catch(() => null),
        websiteCmsApi.getContent('about').catch(() => null),
        websiteCmsApi.getProducts().catch(() => []),
        websiteCmsApi.getGallery().catch(() => []),
      ]);

      if (homeData && Object.keys(homeData).length > 0) setHomeContent(homeData);
      if (aboutData && Object.keys(aboutData).length > 0) setAboutContent(aboutData);
      setProducts(prods);
      setGalleryItems(gallery);
    } catch (err) {
      console.error('Failed to load CMS data:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // 1. Save Home Content
  const handleSaveHome = async () => {
    try {
      setSaving(true);
      await websiteCmsApi.updateContent('home', homeContent);
      showToast('success', 'Home page content saved successfully!');
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to save home content');
    } finally {
      setSaving(false);
    }
  };

  // 2. Save About Content
  const handleSaveAbout = async () => {
    try {
      setSaving(true);
      await websiteCmsApi.updateContent('about', aboutContent);
      showToast('success', 'About page content saved successfully!');
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to save about content');
    } finally {
      setSaving(false);
    }
  };

  // 3. Toggle Product Visibility / Featured
  const handleToggleProductVisibility = async (product: CmsProduct, newVisibility: boolean) => {
    try {
      await websiteCmsApi.updateProductVisibility(product.id, {
        isWebsiteVisible: newVisibility,
      });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isWebsiteVisible: newVisibility } : p))
      );
      showToast(
        'success',
        `${product.name} is now ${newVisibility ? 'visible' : 'hidden'} on the website.`
      );
    } catch (err: any) {
      showToast('error', 'Failed to update product visibility');
    }
  };

  const handleToggleProductFeatured = async (product: CmsProduct, newFeatured: boolean) => {
    try {
      await websiteCmsApi.updateProductVisibility(product.id, {
        isFeatured: newFeatured,
      });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isFeatured: newFeatured } : p))
      );
      showToast(
        'success',
        `${product.name} ${newFeatured ? 'featured on Home' : 'removed from Home features'}.`
      );
    } catch (err: any) {
      showToast('error', 'Failed to update featured status');
    }
  };

  // 4. Gallery Add & Delete
  const handleAddMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedia.mediaUrl.trim()) {
      showToast('error', 'Media URL is required');
      return;
    }
    try {
      setSaving(true);
      const created = await websiteCmsApi.createGalleryItem(newMedia);
      setGalleryItems((prev) => [...prev, created]);
      setNewMedia({
        title: '',
        caption: '',
        mediaType: 'IMAGE',
        mediaUrl: '',
        displayOrder: 0,
        isVisible: true,
      });
      setShowAddMedia(false);
      showToast('success', 'Gallery item added successfully!');
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to add gallery item');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGallery = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this media item?')) return;
    try {
      await websiteCmsApi.deleteGalleryItem(id);
      setGalleryItems((prev) => prev.filter((item) => item.id !== id));
      showToast('success', 'Gallery item deleted');
    } catch (err) {
      showToast('error', 'Failed to delete gallery item');
    }
  };

  const handleToggleGalleryVisibility = async (item: CmsGalleryItem) => {
    try {
      const updated = await websiteCmsApi.updateGalleryItem(item.id, {
        isVisible: !item.isVisible,
      });
      setGalleryItems((prev) => (prev.map((i) => (i.id === item.id ? updated : i))));
      showToast('success', `Item is now ${updated.isVisible ? 'visible' : 'hidden'}`);
    } catch (err) {
      showToast('error', 'Failed to update item visibility');
    }
  };

  // 5. Save Contact Settings
  const handleSaveContact = async () => {
    try {
      setSaving(true);
      await websiteCmsApi.updateContactSettings(contactSettings);
      showToast('success', 'Store contact & social settings updated!');
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to update contact settings');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.gujaratiName && p.gujaratiName.includes(productSearch)) ||
      p.code.toLowerCase().includes(productSearch.toLowerCase())
  );

  if (loading) {
    return <LoadingState message="Loading Website CMS..." />;
  }

  return (
    <div className="module-shell-page">
      <Breadcrumb
        items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Website CMS' }]}
      />

      <PageHeader
        title="Website Management (CMS)"
        subtitle="Manage public-facing homepage headlines, about story, product visibility, photo/video gallery, and store contact details."
        actions={
          <div className="header-actions-group">
            <Button
              variant="outline"
              leftIcon={<RefreshCw size={16} />}
              onClick={loadAllCmsData}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              leftIcon={<ExternalLink size={16} />}
              onClick={() => window.open('/', '_blank')}
            >
              Preview Public Website
            </Button>
          </div>
        }
      />

      {/* Feedback Alert */}
      {feedback && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            background: feedback.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: feedback.type === 'success' ? '#15803d' : '#b91c1c',
            border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            fontWeight: 600,
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="cms-tabs-nav">
        <button
          type="button"
          className={`cms-tab-btn ${activeTab === 'HOME' ? 'active' : ''}`}
          onClick={() => setActiveTab('HOME')}
        >
          <Home size={16} />
          <span>Home Page</span>
        </button>

        <button
          type="button"
          className={`cms-tab-btn ${activeTab === 'ABOUT' ? 'active' : ''}`}
          onClick={() => setActiveTab('ABOUT')}
        >
          <FileText size={16} />
          <span>About Story</span>
        </button>

        <button
          type="button"
          className={`cms-tab-btn ${activeTab === 'PRODUCTS' ? 'active' : ''}`}
          onClick={() => setActiveTab('PRODUCTS')}
        >
          <Package size={16} />
          <span>Product Visibility ({products.length})</span>
        </button>

        <button
          type="button"
          className={`cms-tab-btn ${activeTab === 'GALLERY' ? 'active' : ''}`}
          onClick={() => setActiveTab('GALLERY')}
        >
          <ImageIcon size={16} />
          <span>Gallery & Videos ({galleryItems.length})</span>
        </button>

        <button
          type="button"
          className={`cms-tab-btn ${activeTab === 'CONTACT' ? 'active' : ''}`}
          onClick={() => setActiveTab('CONTACT')}
        >
          <Phone size={16} />
          <span>Contact & Socials</span>
        </button>
      </div>

      {/* TAB 1: HOME PAGE CMS */}
      {activeTab === 'HOME' && (
        <div className="cms-card">
          <div className="cms-card-header">
            <div>
              <div className="cms-card-title">
                <Home size={20} color="#3f438f" />
                <span>Home Page Content</span>
              </div>
              <div className="cms-card-subtitle">
                Customize hero banner texts, Gujarati headlines, and announcement bar.
              </div>
            </div>
            <Button
              variant="primary"
              leftIcon={<Save size={16} />}
              onClick={handleSaveHome}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Home Content'}
            </Button>
          </div>

          <div className="cms-form-grid">
            <div>
              <label className="cms-label">Hero Headline (English)</label>
              <input
                type="text"
                className="cms-input"
                value={homeContent.hero?.headlineEn || ''}
                onChange={(e) =>
                  setHomeContent({
                    ...homeContent,
                    hero: { ...homeContent.hero, headlineEn: e.target.value },
                  })
                }
              />
            </div>

            <div>
              <label className="cms-label">Hero Headline (ગુજરાતી)</label>
              <input
                type="text"
                className="cms-input"
                style={{ fontFamily: 'Noto Sans Gujarati, sans-serif' }}
                value={homeContent.hero?.headlineGu || ''}
                onChange={(e) =>
                  setHomeContent({
                    ...homeContent,
                    hero: { ...homeContent.hero, headlineGu: e.target.value },
                  })
                }
              />
            </div>

            <div>
              <label className="cms-label">Hero Subheadline (English)</label>
              <textarea
                className="cms-textarea"
                rows={3}
                value={homeContent.hero?.subheadlineEn || ''}
                onChange={(e) =>
                  setHomeContent({
                    ...homeContent,
                    hero: { ...homeContent.hero, subheadlineEn: e.target.value },
                  })
                }
              />
            </div>

            <div className="cms-form-grid cms-form-grid-2">
              <div>
                <label className="cms-label">Badge Text (e.g. FSSAI Certification)</label>
                <input
                  type="text"
                  className="cms-input"
                  value={homeContent.hero?.badgeText || ''}
                  onChange={(e) =>
                    setHomeContent({
                      ...homeContent,
                      hero: { ...homeContent.hero, badgeText: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <label className="cms-label">Optional Festival Announcement Bar</label>
                <input
                  type="text"
                  className="cms-input"
                  placeholder="e.g. Special Diwali Festive Batches Available!"
                  value={homeContent.announcement || ''}
                  onChange={(e) =>
                    setHomeContent({ ...homeContent, announcement: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ABOUT CONTENT CMS */}
      {activeTab === 'ABOUT' && (
        <div className="cms-card">
          <div className="cms-card-header">
            <div>
              <div className="cms-card-title">
                <FileText size={20} color="#3f438f" />
                <span>About Story & Heritage</span>
              </div>
              <div className="cms-card-subtitle">
                Share the authentic history, Padgol roots, and handweaving tradition.
              </div>
            </div>
            <Button
              variant="primary"
              leftIcon={<Save size={16} />}
              onClick={handleSaveAbout}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save About Content'}
            </Button>
          </div>

          <div className="cms-form-grid">
            <div>
              <label className="cms-label">Story Title (English)</label>
              <input
                type="text"
                className="cms-input"
                value={aboutContent.story?.title || ''}
                onChange={(e) =>
                  setAboutContent({
                    ...aboutContent,
                    story: { ...aboutContent.story, title: e.target.value },
                  })
                }
              />
            </div>

            <div>
              <label className="cms-label">Story Title (ગુજરાતી)</label>
              <input
                type="text"
                className="cms-input"
                style={{ fontFamily: 'Noto Sans Gujarati, sans-serif' }}
                value={aboutContent.story?.titleGu || ''}
                onChange={(e) =>
                  setAboutContent({
                    ...aboutContent,
                    story: { ...aboutContent.story, titleGu: e.target.value },
                  })
                }
              />
            </div>

            <div>
              <label className="cms-label">Story Narrative (Paragraphs separated by new lines)</label>
              <textarea
                className="cms-textarea"
                rows={8}
                value={
                  aboutContent.story?.paragraphs
                    ? aboutContent.story.paragraphs.join('\n\n')
                    : ''
                }
                onChange={(e) =>
                  setAboutContent({
                    ...aboutContent,
                    story: {
                      ...aboutContent.story,
                      paragraphs: e.target.value
                        .split('\n\n')
                        .map((p: string) => p.trim())
                        .filter(Boolean),
                    },
                  })
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PRODUCTS CATALOG VISIBILITY */}
      {activeTab === 'PRODUCTS' && (
        <div className="cms-card">
          <div className="cms-card-header">
            <div>
              <div className="cms-card-title">
                <Package size={20} color="#3f438f" />
                <span>Product Website Visibility & Features</span>
              </div>
              <div className="cms-card-subtitle">
                Choose which products appear on the public website and select featured items for the Home page.
              </div>
            </div>

            <div style={{ position: 'relative', width: '280px' }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}
              />
              <input
                type="text"
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem 0.5rem 2rem',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.88rem',
                }}
              />
            </div>
          </div>

          <div className="cms-table-container">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Show on Website</th>
                  <th>Featured on Home</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <img
                          src={p.imageUrl || '/logo.png'}
                          alt={p.name}
                          style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>{p.name}</div>
                          {p.gujaratiName && (
                            <div style={{ fontSize: '0.8rem', color: '#8a3038', fontFamily: 'Noto Sans Gujarati, sans-serif' }}>
                              {p.gujaratiName}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{p.subcategory?.category?.name || 'General'}</td>
                    <td>{p.primaryUnit?.symbol || 'Unit'}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleProductVisibility(p, !p.isWebsiteVisible)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          background: p.isWebsiteVisible ? '#dcfce7' : '#f1f5f9',
                          color: p.isWebsiteVisible ? '#15803d' : '#64748b',
                        }}
                      >
                        {p.isWebsiteVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                        <span>{p.isWebsiteVisible ? 'Visible' : 'Hidden'}</span>
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleProductFeatured(p, !p.isFeatured)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          background: p.isFeatured ? '#fef9c3' : '#f1f5f9',
                          color: p.isFeatured ? '#854d0e' : '#64748b',
                        }}
                      >
                        <Star size={14} fill={p.isFeatured ? '#eab308' : 'none'} />
                        <span>{p.isFeatured ? 'Featured' : 'Standard'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: GALLERY CMS */}
      {activeTab === 'GALLERY' && (
        <div className="cms-card">
          <div className="cms-card-header">
            <div>
              <div className="cms-card-title">
                <ImageIcon size={20} color="#3f438f" />
                <span>Gallery & Videos Manager</span>
              </div>
              <div className="cms-card-subtitle">
                Manage photo showcase and approved YouTube video embeds.
              </div>
            </div>

            <Button
              variant="primary"
              leftIcon={<Plus size={16} />}
              onClick={() => setShowAddMedia(!showAddMedia)}
            >
              {showAddMedia ? 'Cancel' : 'Add Photo / Video'}
            </Button>
          </div>

          {/* Add Media Form */}
          {showAddMedia && (
            <form
              onSubmit={handleAddMedia}
              style={{
                padding: '1.5rem',
                background: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                marginBottom: '1.5rem',
              }}
            >
              <h4 style={{ fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>
                Add New Gallery Item
              </h4>
              <div className="cms-form-grid" style={{ marginBottom: '1rem' }}>
                <div className="cms-form-grid cms-form-grid-2">
                  <div>
                    <label className="cms-label">Media Type</label>
                    <select
                      className="cms-input"
                      value={newMedia.mediaType}
                      onChange={(e) =>
                        setNewMedia({
                          ...newMedia,
                          mediaType: e.target.value as 'IMAGE' | 'VIDEO',
                        })
                      }
                    >
                      <option value="IMAGE">Photo / Image</option>
                      <option value="VIDEO">YouTube Video</option>
                    </select>
                  </div>
                  <div>
                    <label className="cms-label">Display Order</label>
                    <input
                      type="number"
                      className="cms-input"
                      value={newMedia.displayOrder}
                      onChange={(e) =>
                        setNewMedia({ ...newMedia, displayOrder: parseInt(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="cms-label">
                    {newMedia.mediaType === 'VIDEO' ? 'YouTube Watch URL' : 'Image URL'}
                  </label>
                  <input
                    type="text"
                    className="cms-input"
                    placeholder={
                      newMedia.mediaType === 'VIDEO'
                        ? 'https://www.youtube.com/watch?v=...'
                        : 'https://... or /logo.png'
                    }
                    value={newMedia.mediaUrl}
                    onChange={(e) => setNewMedia({ ...newMedia, mediaUrl: e.target.value })}
                    required
                  />
                </div>

                <div className="cms-form-grid cms-form-grid-2">
                  <div>
                    <label className="cms-label">Title</label>
                    <input
                      type="text"
                      className="cms-input"
                      value={newMedia.title}
                      onChange={(e) => setNewMedia({ ...newMedia, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="cms-label">Caption / Description</label>
                    <input
                      type="text"
                      className="cms-input"
                      value={newMedia.caption}
                      onChange={(e) => setNewMedia({ ...newMedia, caption: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <Button variant="outline" type="button" onClick={() => setShowAddMedia(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={saving}>
                  {saving ? 'Adding...' : 'Save Media Item'}
                </Button>
              </div>
            </form>
          )}

          {/* Gallery Items Grid */}
          <div className="cms-gallery-grid">
            {galleryItems.map((item) => (
              <div key={item.id} className="cms-gallery-card">
                <div className="cms-gallery-thumb">
                  {item.mediaType === 'VIDEO' ? (
                    <div
                      style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#1e293b',
                        color: '#f87171',
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>YouTube: {item.title || 'Video'}</span>
                    </div>
                  ) : (
                    <img src={item.mediaUrl} alt={item.title || 'Gallery item'} />
                  )}
                </div>

                <div className="cms-gallery-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3f438f' }}>
                      {item.mediaType}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleGalleryVisibility(item)}
                      className={`cms-status-badge ${item.isVisible ? 'visible' : 'hidden'}`}
                      style={{ border: 'none', cursor: 'pointer' }}
                    >
                      {item.isVisible ? 'Visible' : 'Hidden'}
                    </button>
                  </div>

                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', marginBottom: '0.2rem' }}>
                    {item.title || 'Untitled'}
                  </div>
                  {item.caption && (
                    <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.75rem', flex: 1 }}>
                      {item.caption}
                    </p>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      Order: {item.displayOrder}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteGallery(item.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '0.25rem',
                      }}
                      title="Delete Item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: CONTACT & SOCIAL SETTINGS */}
      {activeTab === 'CONTACT' && (
        <div className="cms-card">
          <div className="cms-card-header">
            <div>
              <div className="cms-card-title">
                <Phone size={20} color="#3f438f" />
                <span>Store Contact, Timings & Social Media</span>
              </div>
              <div className="cms-card-subtitle">
                Configure physical Padgol location, phones, Instagram profile, and YouTube links.
              </div>
            </div>
            <Button
              variant="primary"
              leftIcon={<Save size={16} />}
              onClick={handleSaveContact}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Contact & Socials'}
            </Button>
          </div>

          <div className="cms-form-grid">
            <div>
              <label className="cms-label">Store Address (Padgol, Gujarat)</label>
              <textarea
                className="cms-textarea"
                rows={2}
                value={contactSettings.address}
                onChange={(e) =>
                  setContactSettings({ ...contactSettings, address: e.target.value })
                }
              />
            </div>

            <div className="cms-form-grid cms-form-grid-2">
              <div>
                <label className="cms-label">Store Phone Numbers</label>
                <input
                  type="text"
                  className="cms-input"
                  value={contactSettings.phone}
                  onChange={(e) =>
                    setContactSettings({ ...contactSettings, phone: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="cms-label">Store Operating Hours</label>
                <input
                  type="text"
                  className="cms-input"
                  value={contactSettings.businessHours}
                  onChange={(e) =>
                    setContactSettings({ ...contactSettings, businessHours: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="cms-form-grid cms-form-grid-2">
              <div>
                <label className="cms-label">Official Instagram URL</label>
                <input
                  type="text"
                  className="cms-input"
                  value={contactSettings.instagramUrl}
                  onChange={(e) =>
                    setContactSettings({ ...contactSettings, instagramUrl: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="cms-label">Primary YouTube URL</label>
                <input
                  type="text"
                  className="cms-input"
                  value={contactSettings.youtubeUrl}
                  onChange={(e) =>
                    setContactSettings({ ...contactSettings, youtubeUrl: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <label className="cms-label">Google Maps Link</label>
              <input
                type="text"
                className="cms-input"
                value={contactSettings.googleMapsUrl}
                onChange={(e) =>
                  setContactSettings({ ...contactSettings, googleMapsUrl: e.target.value })
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
