import { apiClient } from '../../services/api/api-client';

export interface PublicCompanyInfo {
  companyName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  businessHours: string;
  googleMapsUrl?: string;
  instagramUrl: string;
  youtubeUrl: string;
  gstin?: string;
  fssaiLicense?: string;
  // WhatsApp & Direct Call Configuration
  whatsappNumber?: string;
  phoneNumber?: string;
  defaultWhatsappMessage?: string;
  productWhatsappMessage?: string;
  whatsappEnabled?: boolean;
  floatingWhatsappEnabled?: boolean;
  productInquiryEnabled?: boolean;
}

export interface PublicProductPack {
  id: string;
  packName: string;
  weightInBaseUnits: number | string;
}

export interface PublicProduct {
  id: string;
  name: string;
  gujaratiName?: string | null;
  code: string;
  description?: string | null;
  imageUrl?: string | null;
  isFeatured: boolean;
  subcategory: {
    id: string;
    name: string;
    categoryId?: string;
    category?: {
      id: string;
      name: string;
    };
  };
  primaryUnit: {
    id?: string;
    name?: string;
    symbol: string;
  };
  packConfigurations?: PublicProductPack[];
}

export interface PublicCategory {
  id: string;
  name: string;
  code: string;
  subcategories: {
    id: string;
    name: string;
    code: string;
  }[];
}

export interface PublicGalleryItem {
  id: string;
  title?: string | null;
  caption?: string | null;
  mediaType: 'IMAGE' | 'VIDEO';
  mediaUrl: string;
  thumbnailUrl?: string | null;
  displayOrder: number;
}

export interface PublicHomeData {
  content: {
    hero?: {
      headlineEn?: string;
      headlineGu?: string;
      subheadlineEn?: string;
      subheadlineGu?: string;
      ctaPrimaryText?: string;
      ctaPrimaryLink?: string;
      ctaSecondaryText?: string;
      ctaSecondaryLink?: string;
      badgeText?: string;
    };
    highlights?: Array<{
      id: string;
      title: string;
      description: string;
      icon: string;
    }>;
    craftsmanship?: {
      title?: string;
      titleGu?: string;
      description?: string;
    };
    announcement?: string;
  };
  company: PublicCompanyInfo;
  featuredProducts: PublicProduct[];
  featuredVideos: PublicGalleryItem[];
  categories: PublicCategory[];
}

export interface PublicAboutData {
  content: {
    story?: {
      title?: string;
      titleGu?: string;
      paragraphs?: string[];
    };
    values?: Array<{
      title: string;
      description: string;
    }>;
    qualityStandards?: {
      fssaiNumber?: string;
      gstin?: string;
      location?: string;
    };
  };
  company: PublicCompanyInfo;
}

export interface PublicProductsResponse {
  products: PublicProduct[];
  categories: PublicCategory[];
  totalCount: number;
}

export interface PublicGalleryResponse {
  items: PublicGalleryItem[];
  totalCount: number;
}

export const publicWebsiteApi = {
  getHome: async (): Promise<PublicHomeData> => {
    const res = await apiClient.get<PublicHomeData>('/public/home');
    return res.data;
  },

  getAbout: async (): Promise<PublicAboutData> => {
    const res = await apiClient.get<PublicAboutData>('/public/about');
    return res.data;
  },

  getProducts: async (params?: {
    search?: string;
    categoryId?: string;
    subcategoryId?: string;
  }): Promise<PublicProductsResponse> => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    if (params?.subcategoryId) query.set('subcategoryId', params.subcategoryId);
    const qs = query.toString();
    const endpoint = qs ? `/public/products?${qs}` : '/public/products';
    const res = await apiClient.get<PublicProductsResponse>(endpoint);
    return res.data;
  },

  getProductDetail: async (
    id: string
  ): Promise<{ product: PublicProduct; relatedProducts: Partial<PublicProduct>[] }> => {
    const res = await apiClient.get<{ product: PublicProduct; relatedProducts: Partial<PublicProduct>[] }>(
      `/public/products/${id}`
    );
    return res.data;
  },

  getGallery: async (type?: 'IMAGE' | 'VIDEO'): Promise<PublicGalleryResponse> => {
    const endpoint = type ? `/public/gallery?type=${type}` : '/public/gallery';
    const res = await apiClient.get<PublicGalleryResponse>(endpoint);
    return res.data;
  },

  getContact: async (): Promise<PublicCompanyInfo> => {
    const res = await apiClient.get<PublicCompanyInfo>('/public/contact');
    return res.data;
  },

  getSettings: async (): Promise<PublicCompanyInfo> => {
    const res = await apiClient.get<PublicCompanyInfo>('/public/settings');
    return res.data;
  },
};
