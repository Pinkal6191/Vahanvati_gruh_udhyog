import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Info,
  Edit3,
  X,
  Filter,
  Upload,
  Film,
  Link as LinkIcon,
  Settings as SettingsIcon,
  MessageSquare,
  Sliders,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Button } from '../../components/ui/Button/Button';
import { LoadingState } from '../../components/common/LoadingState/LoadingState';
import {
  websiteCmsApi,
  CmsProduct,
  CmsGalleryItem,
  CmsWebsiteSettings,
} from './website-cms.api';
import { resolveMediaUrl } from '../../services/api/api-client';
import { clearPublicSettingsCache } from '../public-website/hooks/usePublicSettings';
import './WebsitePage.css';

type CmsTab = 'HOME' | 'ABOUT' | 'PRODUCTS' | 'GALLERY' | 'CONTACT' | 'SETTINGS';

export const WebsitePage: React.FC = () => {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

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
  const [selectedCmsCategory, setSelectedCmsCategory] = useState('');
  const [editingProduct, setEditingProduct] = useState<CmsProduct | null>(null);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsWebsiteVisible, setEditIsWebsiteVisible] = useState(true);
  const [editIsFeatured, setEditIsFeatured] = useState(false);
  const [galleryItems, setGalleryItems] = useState<CmsGalleryItem[]>([]);

  // New Media Item Form (Gallery)
  const [newMedia, setNewMedia] = useState({
    title: '',
    caption: '',
    mediaType: 'IMAGE' as 'IMAGE' | 'VIDEO',
    mediaUrl: '',
    displayOrder: 0,
    isVisible: true,
  });
  const [showAddMedia, setShowAddMedia] = useState(false);
  const [galleryUploadMode, setGalleryUploadMode] = useState<'FILE' | 'URL'>('FILE');
  const [selectedGalleryFile, setSelectedGalleryFile] = useState<File | null>(null);
  const [galleryFilePreview, setGalleryFilePreview] = useState<string | null>(null);
  const [uploadingGalleryFile, setUploadingGalleryFile] = useState(false);

  // Product Photo Edit Form
  const [productPhotoUploadMode, setProductPhotoUploadMode] = useState<'FILE' | 'URL'>('FILE');
  const [selectedProductFile, setSelectedProductFile] = useState<File | null>(null);
  const [productFilePreview, setProductFilePreview] = useState<string | null>(null);
  const [uploadingProductFile, setUploadingProductFile] = useState(false);

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

  // Website & WhatsApp Settings
  const [websiteSettings, setWebsiteSettings] = useState<CmsWebsiteSettings>({
    whatsappNumber: '919714917851',
    phoneNumber: '+91 97149 17851',
    defaultWhatsappMessage:
      'Hello Vahanvati Gruh Udhyog, I would like to know more about your products.',
    productWhatsappMessage:
      'Hello Vahanvati Gruh Udhyog, I am interested in {productName}. Please share more details and pricing.',
    whatsappEnabled: true,
    floatingWhatsappEnabled: true,
    productInquiryEnabled: true,
    address: 'હાઈસ્કૂલની પાસે, નડિયાદ - પેટલાદ રોડ, પાડગોલ - ૩૮૮ ૪૪૦',
    phone: '+91 97149 17851 / +91 97121 15118',
    email: 'info@vahanvati.com',
    businessHours: 'Monday - Sunday: 8:00 AM - 8:30 PM',
    googleMapsUrl: 'https://maps.google.com/?q=Padgol+Gujarat',
    instagramUrl: 'https://www.instagram.com/vahanvatigruhudhyog/',
    youtubeUrl: 'https://www.youtube.com/watch?v=FrB9KyMpOxQ',
    tagline: 'હાથ વણાટના સ્પે. સારેવડા તેમજ સેવો તથા વડી બનાવનાર.',
  });

  // Sync tab with URL parameter
  useEffect(() => {
    if (tab) {
      const upper = tab.toUpperCase();
      if (['HOME', 'ABOUT', 'PRODUCTS', 'GALLERY', 'CONTACT', 'SETTINGS'].includes(upper)) {
        setActiveTab(upper as CmsTab);
      }
    }
  }, [tab]);

  const handleTabChange = (newTab: CmsTab) => {
    setActiveTab(newTab);
    navigate(`/manage/${newTab.toLowerCase()}`);
  };

  useEffect(() => {
    loadAllCmsData();
  }, []);

  const loadAllCmsData = async () => {
    try {
      setLoading(true);
      const [homeData, aboutData, prods, gallery, settingsData] = await Promise.all([
        websiteCmsApi.getContent('home').catch(() => null),
        websiteCmsApi.getContent('about').catch(() => null),
        websiteCmsApi.getProducts().catch(() => []),
        websiteCmsApi.getGallery().catch(() => []),
        websiteCmsApi.getSettings().catch(() => null),
      ]);

      if (homeData && Object.keys(homeData).length > 0) setHomeContent(homeData);
      if (aboutData && Object.keys(aboutData).length > 0) setAboutContent(aboutData);
      setProducts(prods);
      setGalleryItems(gallery);
      if (settingsData && Object.keys(settingsData).length > 0) {
        setWebsiteSettings(settingsData);
        setContactSettings((prev) => ({
          ...prev,
          address: settingsData.address || prev.address,
          phone: settingsData.phoneNumber || settingsData.phone || prev.phone,
          email: settingsData.email || prev.email,
          businessHours: settingsData.businessHours || prev.businessHours,
          googleMapsUrl: settingsData.googleMapsUrl || prev.googleMapsUrl,
          instagramUrl: settingsData.instagramUrl || prev.instagramUrl,
          youtubeUrl: settingsData.youtubeUrl || prev.youtubeUrl,
        }));
      }
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
  const handleGalleryFileSelect = (file: File | null) => {
    if (!file) {
      setSelectedGalleryFile(null);
      setGalleryFilePreview(null);
      return;
    }
    setSelectedGalleryFile(file);
    const isVideo = file.type.startsWith('video/');
    setNewMedia((prev) => ({
      ...prev,
      mediaType: isVideo ? 'VIDEO' : 'IMAGE',
      title: prev.title || file.name.replace(/\.[^/.]+$/, ''),
    }));
    const previewUrl = URL.createObjectURL(file);
    setGalleryFilePreview(previewUrl);
  };

  const handleAddMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      let finalMediaUrl = newMedia.mediaUrl.trim();
      let finalMediaType = newMedia.mediaType;

      if (galleryUploadMode === 'FILE') {
        if (!selectedGalleryFile) {
          showToast('error', 'Please select a photo or video file to upload');
          setSaving(false);
          return;
        }
        setUploadingGalleryFile(true);
        const uploadRes = await websiteCmsApi.uploadMedia(selectedGalleryFile);
        finalMediaUrl = uploadRes.url;
        finalMediaType = uploadRes.mediaType;
        setUploadingGalleryFile(false);
      } else {
        if (!finalMediaUrl) {
          showToast('error', 'Media URL is required');
          setSaving(false);
          return;
        }
      }

      const created = await websiteCmsApi.createGalleryItem({
        ...newMedia,
        mediaUrl: finalMediaUrl,
        mediaType: finalMediaType,
      });

      setGalleryItems((prev) => [...prev, created]);
      setNewMedia({
        title: '',
        caption: '',
        mediaType: 'IMAGE',
        mediaUrl: '',
        displayOrder: 0,
        isVisible: true,
      });
      setSelectedGalleryFile(null);
      setGalleryFilePreview(null);
      setShowAddMedia(false);
      showToast('success', 'Gallery item added successfully!');
    } catch (err: any) {
      showToast('error', err.response?.data?.message || err.message || 'Failed to add gallery item');
    } finally {
      setSaving(false);
      setUploadingGalleryFile(false);
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
      clearPublicSettingsCache();
      showToast('success', 'Store contact & social settings updated!');
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to update contact settings');
    } finally {
      setSaving(false);
    }
  };

  // 6. Save WhatsApp & Website Settings
  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const updated = await websiteCmsApi.updateSettings(websiteSettings);
      setWebsiteSettings(updated);
      clearPublicSettingsCache();
      showToast('success', 'WhatsApp and website configuration saved successfully!');
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to save website settings');
    } finally {
      setSaving(false);
    }
  };

  // Edit Product Details (Photos & Descriptions for Public Website)
  const handleStartEditProduct = (product: CmsProduct) => {
    setEditingProduct(product);
    setEditImageUrl(product.imageUrl || '');
    setEditDescription(product.description || '');
    setEditIsWebsiteVisible(product.isWebsiteVisible);
    setEditIsFeatured(product.isFeatured);
    setProductPhotoUploadMode('FILE');
    setSelectedProductFile(null);
    setProductFilePreview(null);
  };

  const handleProductFileSelect = (file: File | null) => {
    if (!file) {
      setSelectedProductFile(null);
      setProductFilePreview(null);
      return;
    }
    setSelectedProductFile(file);
    const previewUrl = URL.createObjectURL(file);
    setProductFilePreview(previewUrl);
  };

  const handleSaveProductDetails = async () => {
    if (!editingProduct) return;
    try {
      setSaving(true);
      let targetImageUrl = editImageUrl.trim();

      if (productPhotoUploadMode === 'FILE' && selectedProductFile) {
        setUploadingProductFile(true);
        const uploadRes = await websiteCmsApi.uploadMedia(selectedProductFile);
        targetImageUrl = uploadRes.url;
        setUploadingProductFile(false);
      }

      await websiteCmsApi.updateProductVisibility(editingProduct.id, {
        imageUrl: targetImageUrl || undefined,
        description: editDescription.trim() || undefined,
        isWebsiteVisible: editIsWebsiteVisible,
        isFeatured: editIsFeatured,
      });

      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProduct.id
            ? {
                ...p,
                imageUrl: targetImageUrl || undefined,
                description: editDescription.trim() || undefined,
                isWebsiteVisible: editIsWebsiteVisible,
                isFeatured: editIsFeatured,
              }
            : p
        )
      );

      showToast('success', `${editingProduct.name} website presentation updated!`);
      setEditingProduct(null);
    } catch (err: any) {
      showToast('error', 'Failed to update product details');
    } finally {
      setSaving(false);
      setUploadingProductFile(false);
    }
  };

  const distinctCategories = Array.from(
    new Set(
      products
        .map((p) => p.subcategory?.category?.name)
        .filter((c): c is string => Boolean(c))
    )
  );

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.gujaratiName && p.gujaratiName.includes(productSearch)) ||
      p.code.toLowerCase().includes(productSearch.toLowerCase());

    const matchesCategory =
      !selectedCmsCategory || p.subcategory?.category?.name === selectedCmsCategory;

    return matchesSearch && matchesCategory;
  });

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
          onClick={() => handleTabChange('HOME')}
        >
          <Home size={16} />
          <span>Home Page</span>
        </button>

        <button
          type="button"
          className={`cms-tab-btn ${activeTab === 'ABOUT' ? 'active' : ''}`}
          onClick={() => handleTabChange('ABOUT')}
        >
          <FileText size={16} />
          <span>About Story</span>
        </button>

        <button
          type="button"
          className={`cms-tab-btn ${activeTab === 'PRODUCTS' ? 'active' : ''}`}
          onClick={() => handleTabChange('PRODUCTS')}
        >
          <Package size={16} />
          <span>Product Visibility ({products.length})</span>
        </button>

        <button
          type="button"
          className={`cms-tab-btn ${activeTab === 'GALLERY' ? 'active' : ''}`}
          onClick={() => handleTabChange('GALLERY')}
        >
          <ImageIcon size={16} />
          <span>Gallery & Videos ({galleryItems.length})</span>
        </button>

        <button
          type="button"
          className={`cms-tab-btn ${activeTab === 'CONTACT' ? 'active' : ''}`}
          onClick={() => handleTabChange('CONTACT')}
        >
          <Phone size={16} />
          <span>Contact & Socials</span>
        </button>

        <button
          type="button"
          className={`cms-tab-btn ${activeTab === 'SETTINGS' ? 'active' : ''}`}
          onClick={() => handleTabChange('SETTINGS')}
        >
          <SettingsIcon size={16} />
          <span>Settings & WhatsApp</span>
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

      {/* TAB 3: PRODUCTS CATALOG VISIBILITY & PHOTOS */}
      {activeTab === 'PRODUCTS' && (
        <div className="cms-card">
          <div className="cms-card-header">
            <div>
              <div className="cms-card-title">
                <Package size={20} color="#3f438f" />
                <span>Product Website Visibility & Photos</span>
              </div>
              <div className="cms-card-subtitle">
                Choose which products appear on the public website, set photos, descriptions, and feature items for the Home page.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Category Filter */}
              <select
                value={selectedCmsCategory}
                onChange={(e) => setSelectedCmsCategory(e.target.value)}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.88rem',
                  background: '#ffffff',
                  color: '#334155',
                }}
              >
                <option value="">All Categories</option>
                {distinctCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* Search */}
              <div style={{ position: 'relative', width: '240px' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50)',
                    color: '#9ca3af',
                  }}
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
          </div>

          {/* POS Non-Interference Notice */}
          <div
            style={{
              padding: '0.85rem 1.25rem',
              background: '#eff6ff',
              borderRadius: '8px',
              border: '1px solid #bfdbfe',
              color: '#1e40af',
              marginBottom: '1.25rem',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
            }}
          >
            <Info size={18} style={{ flexShrink: 0 }} />
            <span>
              <strong>Independent Website Catalog:</strong> Changes made here manage how products appear on the public website (photos, descriptions, visibility). They <strong>do not affect</strong> POS billing, cashier operations, active sale prices, barcodes, or inventory stock balances.
            </span>
          </div>

          <div className="cms-table-container">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Product & Photo</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Show on Website</th>
                  <th>Featured on Home</th>
                  <th>Actions</th>
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
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '8px',
                            objectFit: 'cover',
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc',
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/logo.png';
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>{p.name}</div>
                          {p.gujaratiName && (
                            <div
                              style={{
                                fontSize: '0.82rem',
                                color: '#8a3038',
                                fontFamily: 'Noto Sans Gujarati, sans-serif',
                                fontWeight: 600,
                              }}
                            >
                              {p.gujaratiName}
                            </div>
                          )}
                          {p.description && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                              {p.description.length > 50 ? `${p.description.slice(0, 50)}...` : p.description}
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
                    <td>
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Edit3 size={14} />}
                        onClick={() => handleStartEditProduct(p)}
                      >
                        Edit Photo & Info
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Modal: Edit Website Presentation for Product */}
          {editingProduct && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '1rem',
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  width: '100%',
                  maxWidth: '560px',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                      Edit Website Details: {editingProduct.name}
                    </h3>
                    <div
                      style={{
                        fontSize: '0.85rem',
                        color: '#8a3038',
                        fontFamily: 'Noto Sans Gujarati, sans-serif',
                        marginTop: '0.2rem',
                      }}
                    >
                      {editingProduct.gujaratiName}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Photo Mode Switcher */}
                  <div>
                    <label className="cms-label">Product Image Source (પ્રોડક્ટ ફોટો)</label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => setProductPhotoUploadMode('FILE')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.45rem 0.9rem',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: productPhotoUploadMode === 'FILE' ? '#3f438f' : '#f8fafc',
                          color: productPhotoUploadMode === 'FILE' ? '#ffffff' : '#475569',
                        }}
                      >
                        <Upload size={14} />
                        <span>Upload File (કમ્પ્યુટર/મોબાઈલમાંથી ફાઈલ)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductPhotoUploadMode('URL')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.45rem 0.9rem',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: productPhotoUploadMode === 'URL' ? '#3f438f' : '#f8fafc',
                          color: productPhotoUploadMode === 'URL' ? '#ffffff' : '#475569',
                        }}
                      >
                        <LinkIcon size={14} />
                        <span>Direct Image URL (લિંક)</span>
                      </button>
                    </div>

                    {/* Preview + Input Container */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'center',
                        padding: '1rem',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <img
                        src={productFilePreview || resolveMediaUrl(editImageUrl)}
                        alt="Preview"
                        style={{
                          width: '72px',
                          height: '72px',
                          borderRadius: '8px',
                          objectFit: 'cover',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          flexShrink: 0,
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/logo.png';
                        }}
                      />

                      <div style={{ flex: 1 }}>
                        {productPhotoUploadMode === 'FILE' ? (
                          <div>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                              onChange={(e) => handleProductFileSelect(e.target.files?.[0] || null)}
                              style={{
                                width: '100%',
                                fontSize: '0.88rem',
                                color: '#334155',
                              }}
                            />
                            {selectedProductFile && (
                              <div style={{ fontSize: '0.78rem', color: '#16a34a', marginTop: '0.35rem', fontWeight: 600 }}>
                                Selected: {selectedProductFile.name} ({(selectedProductFile.size / 1024).toFixed(1)} KB)
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <input
                              type="text"
                              className="cms-input"
                              placeholder="https://... or /uploads/..."
                              value={editImageUrl}
                              onChange={(e) => {
                                setEditImageUrl(e.target.value);
                                setProductFilePreview(null);
                              }}
                              style={{ width: '100%' }}
                            />
                          </div>
                        )}
                        <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.35rem', display: 'block' }}>
                          Supported formats: JPG, PNG, WEBP, GIF. Saved only for website presentation.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Description Input */}
                  <div>
                    <label className="cms-label">Website Description (વેબસાઇટ વિગત)</label>
                    <textarea
                      className="cms-textarea"
                      rows={3}
                      placeholder="Enter consumer description, ingredients, or taste highlights for this product..."
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                  </div>

                  {/* Toggles */}
                  <div style={{ display: 'flex', gap: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={editIsWebsiteVisible}
                        onChange={(e) => setEditIsWebsiteVisible(e.target.checked)}
                      />
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                        Show on Public Website
                      </span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={editIsFeatured}
                        onChange={(e) => setEditIsFeatured(e.target.checked)}
                      />
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                        Feature on Home Page
                      </span>
                    </label>
                  </div>
                </div>

                <div
                  style={{
                    padding: '1rem 1.5rem',
                    background: '#f8fafc',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.75rem',
                  }}
                >
                  <Button variant="outline" onClick={() => setEditingProduct(null)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    leftIcon={<Save size={16} />}
                    onClick={handleSaveProductDetails}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Product Details'}
                  </Button>
                </div>
              </div>
            </div>
          )}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h4 style={{ fontWeight: 700, margin: 0, color: '#1e293b' }}>
                  Add Photo / Video to Website Gallery
                </h4>

                {/* Mode Switcher */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setGalleryUploadMode('FILE')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.4rem 0.85rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: galleryUploadMode === 'FILE' ? '#3f438f' : '#ffffff',
                      color: galleryUploadMode === 'FILE' ? '#ffffff' : '#475569',
                    }}
                  >
                    <Upload size={14} />
                    <span>Upload Local File (કમ્પ્યુટર/મોબાઈલમાંથી)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGalleryUploadMode('URL')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.4rem 0.85rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: galleryUploadMode === 'URL' ? '#3f438f' : '#ffffff',
                      color: galleryUploadMode === 'URL' ? '#ffffff' : '#475569',
                    }}
                  >
                    <LinkIcon size={14} />
                    <span>Direct Web URL / YouTube</span>
                  </button>
                </div>
              </div>

              <div className="cms-form-grid" style={{ marginBottom: '1.25rem' }}>
                {galleryUploadMode === 'FILE' ? (
                  /* File Upload Input Box */
                  <div
                    style={{
                      padding: '1.25rem',
                      background: '#ffffff',
                      borderRadius: '8px',
                      border: '2px dashed #cbd5e1',
                      textAlign: 'center',
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*,video/*"
                      id="gallery-file-input"
                      onChange={(e) => handleGalleryFileSelect(e.target.files?.[0] || null)}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="gallery-file-input"
                      style={{
                        display: 'inline-flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        padding: '1rem',
                      }}
                    >
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          background: '#eef0f9',
                          color: '#3f438f',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Upload size={22} />
                      </div>
                      <span style={{ fontWeight: 700, color: '#1e293b' }}>
                        Click to Choose Photo or Video file
                      </span>
                      <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                        Supports JPEG, PNG, WEBP, GIF, MP4, WebM (Up to 50MB)
                      </span>
                    </label>

                    {selectedGalleryFile && (
                      <div
                        style={{
                          marginTop: '1rem',
                          padding: '0.75rem 1rem',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '1rem',
                        }}
                      >
                        {newMedia.mediaType === 'VIDEO' ? (
                          <video
                            src={galleryFilePreview || ''}
                            controls
                            style={{ height: '100px', borderRadius: '6px', maxWidth: '160px' }}
                          />
                        ) : (
                          <img
                            src={galleryFilePreview || ''}
                            alt="Preview"
                            style={{ height: '80px', borderRadius: '6px', objectFit: 'contain' }}
                          />
                        )}
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>
                            {selectedGalleryFile.name}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            Type: <strong>{newMedia.mediaType}</strong> • Size:{' '}
                            {(selectedGalleryFile.size / (1024 * 1024)).toFixed(2)} MB
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Direct URL Input */
                  <div>
                    <div className="cms-form-grid cms-form-grid-2" style={{ marginBottom: '1rem' }}>
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
                          <option value="IMAGE">Photo / Image URL</option>
                          <option value="VIDEO">YouTube Video URL</option>
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
                        {newMedia.mediaType === 'VIDEO' ? 'YouTube Watch URL' : 'Image Web URL'}
                      </label>
                      <input
                        type="text"
                        className="cms-input"
                        placeholder={
                          newMedia.mediaType === 'VIDEO'
                            ? 'https://www.youtube.com/watch?v=...'
                            : 'https://images.unsplash.com/... or /logo.png'
                        }
                        value={newMedia.mediaUrl}
                        onChange={(e) => setNewMedia({ ...newMedia, mediaUrl: e.target.value })}
                        required={galleryUploadMode === 'URL'}
                      />
                    </div>
                  </div>
                )}

                <div className="cms-form-grid cms-form-grid-2" style={{ marginTop: '1rem' }}>
                  <div>
                    <label className="cms-label">Title (શીર્ષક)</label>
                    <input
                      type="text"
                      className="cms-input"
                      placeholder="e.g. Traditional Handweaving / કિચન બનાવટ"
                      value={newMedia.title}
                      onChange={(e) => setNewMedia({ ...newMedia, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="cms-label">Caption / Description (વર્ણન)</label>
                    <input
                      type="text"
                      className="cms-input"
                      placeholder="e.g. Crafted with pure ingredients in Padgol facility..."
                      value={newMedia.caption}
                      onChange={(e) => setNewMedia({ ...newMedia, caption: e.target.value })}
                    />
                  </div>
                </div>

                {galleryUploadMode === 'FILE' && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
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
                    <div style={{ flex: 1 }}>
                      <label className="cms-label">Media Type (Auto-detected)</label>
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
                        <option value="VIDEO">Video</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <Button variant="outline" type="button" onClick={() => setShowAddMedia(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  leftIcon={<Save size={16} />}
                  disabled={saving || uploadingGalleryFile}
                >
                  {uploadingGalleryFile ? 'Uploading File...' : saving ? 'Saving...' : 'Save Media Item'}
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
                    item.mediaUrl.includes('youtube.com') || item.mediaUrl.includes('youtu.be') ? (
                      <div
                        style={{
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#1e293b',
                          color: '#f87171',
                          padding: '1rem',
                          textAlign: 'center',
                        }}
                      >
                        <Film size={28} style={{ marginBottom: '0.5rem' }} />
                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                          YouTube Video: {item.title || 'Clip'}
                        </span>
                      </div>
                    ) : (
                      <video
                        src={resolveMediaUrl(item.mediaUrl)}
                        controls
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )
                  ) : (
                    <img
                      src={resolveMediaUrl(item.mediaUrl)}
                      alt={item.title || 'Gallery item'}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/logo.png';
                      }}
                    />
                  )}
                </div>

                <div className="cms-gallery-body">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.4rem',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: item.mediaType === 'VIDEO' ? '#dc2626' : '#3f438f',
                        background: item.mediaType === 'VIDEO' ? '#fee2e2' : '#eef0f9',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                      }}
                    >
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

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: 'auto',
                      paddingTop: '0.5rem',
                      borderTop: '1px solid #f1f5f9',
                    }}
                  >
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

      {/* TAB 6: SETTINGS & WHATSAPP CMS */}
      {activeTab === 'SETTINGS' && (
        <div className="cms-card">
          <div className="cms-card-header">
            <div>
              <div className="cms-card-title">
                <SettingsIcon size={20} color="#3f438f" />
                <span>Website & WhatsApp Settings</span>
              </div>
              <div className="cms-card-subtitle">
                Configure WhatsApp numbers, direct call phone, message templates, and inquiry toggles.
              </div>
            </div>
            <Button
              variant="primary"
              leftIcon={<Save size={16} />}
              onClick={handleSaveSettings}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>

          <div className="cms-form-grid" style={{ gap: '1.75rem' }}>
            {/* Feature Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                Inquiry & Button Controls
              </h3>

              <div className="cms-toggle-row">
                <div className="cms-toggle-info">
                  <span className="cms-toggle-title">Enable WhatsApp Inquiry Globally</span>
                  <span className="cms-toggle-desc">
                    Master switch for all WhatsApp buttons across the website (floating button, product cards, detail page, and contact page).
                  </span>
                </div>
                <label className="cms-switch" aria-label="Toggle WhatsApp Globally">
                  <input
                    type="checkbox"
                    checked={websiteSettings.whatsappEnabled !== false}
                    onChange={(e) =>
                      setWebsiteSettings({ ...websiteSettings, whatsappEnabled: e.target.checked })
                    }
                  />
                  <span className="cms-switch-slider" />
                </label>
              </div>

              <div className="cms-toggle-row">
                <div className="cms-toggle-info">
                  <span className="cms-toggle-title">Floating WhatsApp Quick Chat Button</span>
                  <span className="cms-toggle-desc">
                    Show the fixed bottom-right floating WhatsApp button across all public pages.
                  </span>
                </div>
                <label className="cms-switch" aria-label="Toggle Floating WhatsApp Button">
                  <input
                    type="checkbox"
                    checked={websiteSettings.floatingWhatsappEnabled !== false}
                    onChange={(e) =>
                      setWebsiteSettings({
                        ...websiteSettings,
                        floatingWhatsappEnabled: e.target.checked,
                      })
                    }
                  />
                  <span className="cms-switch-slider" />
                </label>
              </div>

              <div className="cms-toggle-row">
                <div className="cms-toggle-info">
                  <span className="cms-toggle-title">Product-Level WhatsApp Inquiries</span>
                  <span className="cms-toggle-desc">
                    Show "Enquire on WhatsApp" action buttons on catalog product cards and product detail pages.
                  </span>
                </div>
                <label className="cms-switch" aria-label="Toggle Product-Level WhatsApp Inquiries">
                  <input
                    type="checkbox"
                    checked={websiteSettings.productInquiryEnabled !== false}
                    onChange={(e) =>
                      setWebsiteSettings({
                        ...websiteSettings,
                        productInquiryEnabled: e.target.checked,
                      })
                    }
                  />
                  <span className="cms-switch-slider" />
                </label>
              </div>
            </div>

            {/* Phone & Contact Numbers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                Phone & WhatsApp Numbers
              </h3>

              <div className="cms-form-grid cms-form-grid-2">
                <div>
                  <label className="cms-label">
                    WhatsApp Phone Number (for wa.me links)
                  </label>
                  <input
                    type="text"
                    className="cms-input"
                    placeholder="919714917851"
                    value={websiteSettings.whatsappNumber || ''}
                    onChange={(e) =>
                      setWebsiteSettings({ ...websiteSettings, whatsappNumber: e.target.value })
                    }
                  />
                  <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.35rem', display: 'block' }}>
                    Enter with country code (e.g. 919714917851 for India).
                  </span>
                </div>

                <div>
                  <label className="cms-label">
                    Direct Call Phone Number (for tel: links)
                  </label>
                  <input
                    type="text"
                    className="cms-input"
                    placeholder="+91 97149 17851"
                    value={websiteSettings.phoneNumber || ''}
                    onChange={(e) =>
                      setWebsiteSettings({ ...websiteSettings, phoneNumber: e.target.value })
                    }
                  />
                  <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.35rem', display: 'block' }}>
                    Primary telephone number dialed when clicking "Call Now".
                  </span>
                </div>
              </div>
            </div>

            {/* Message Templates */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                WhatsApp Inquiry Message Templates
              </h3>

              <div>
                <label className="cms-label">Default WhatsApp Message (Floating Button & General)</label>
                <textarea
                  className="cms-textarea"
                  rows={2}
                  value={websiteSettings.defaultWhatsappMessage || ''}
                  onChange={(e) =>
                    setWebsiteSettings({
                      ...websiteSettings,
                      defaultWhatsappMessage: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label className="cms-label">
                  Product Inquiry Message Template (use <code>{'{productName}'}</code> placeholder)
                </label>
                <textarea
                  className="cms-textarea"
                  rows={2}
                  value={websiteSettings.productWhatsappMessage || ''}
                  onChange={(e) =>
                    setWebsiteSettings({
                      ...websiteSettings,
                      productWhatsappMessage: e.target.value,
                    })
                  }
                />
                <div className="cms-preview-box">
                  <div className="cms-preview-title">Live Message Preview:</div>
                  <div className="cms-preview-content">
                    {(websiteSettings.productWhatsappMessage ||
                      'Hello Vahanvati Gruh Udhyog, I am interested in {productName}. Please share more details and pricing.'
                    ).replace(/\{productName\}/g, 'તીખા સારેવડા (Tikha Sarewada)')}
                  </div>
                </div>
              </div>
            </div>

            {/* General Contact Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                Company & Store Location Info
              </h3>

              <div>
                <label className="cms-label">Gujarati Tagline / Specialization</label>
                <input
                  type="text"
                  className="cms-input"
                  style={{ fontFamily: 'Noto Sans Gujarati, sans-serif' }}
                  value={websiteSettings.tagline || ''}
                  onChange={(e) =>
                    setWebsiteSettings({ ...websiteSettings, tagline: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="cms-label">Physical Store Address (Padgol, Gujarat)</label>
                <textarea
                  className="cms-textarea"
                  rows={2}
                  value={websiteSettings.address || ''}
                  onChange={(e) =>
                    setWebsiteSettings({ ...websiteSettings, address: e.target.value })
                  }
                />
              </div>

              <div className="cms-form-grid cms-form-grid-2">
                <div>
                  <label className="cms-label">Operating Hours</label>
                  <input
                    type="text"
                    className="cms-input"
                    value={websiteSettings.businessHours || ''}
                    onChange={(e) =>
                      setWebsiteSettings({ ...websiteSettings, businessHours: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="cms-label">Contact Email</label>
                  <input
                    type="email"
                    className="cms-input"
                    value={websiteSettings.email || ''}
                    onChange={(e) =>
                      setWebsiteSettings({ ...websiteSettings, email: e.target.value })
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
                    value={websiteSettings.instagramUrl || ''}
                    onChange={(e) =>
                      setWebsiteSettings({ ...websiteSettings, instagramUrl: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="cms-label">Primary YouTube URL</label>
                  <input
                    type="text"
                    className="cms-input"
                    value={websiteSettings.youtubeUrl || ''}
                    onChange={(e) =>
                      setWebsiteSettings({ ...websiteSettings, youtubeUrl: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="cms-label">Google Maps Link</label>
                <input
                  type="text"
                  className="cms-input"
                  value={websiteSettings.googleMapsUrl || ''}
                  onChange={(e) =>
                    setWebsiteSettings({ ...websiteSettings, googleMapsUrl: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
