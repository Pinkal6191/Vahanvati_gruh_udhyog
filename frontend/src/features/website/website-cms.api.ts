import { apiClient } from '../../services/api/api-client';

export interface CmsProduct {
  id: string;
  name: string;
  gujaratiName?: string | null;
  code: string;
  description?: string | null;
  imageUrl?: string | null;
  isWebsiteVisible: boolean;
  isFeatured: boolean;
  subcategory: {
    id: string;
    name: string;
    category?: {
      id: string;
      name: string;
    };
  };
  primaryUnit: {
    symbol: string;
  };
}

export interface CmsGalleryItem {
  id: string;
  title?: string | null;
  caption?: string | null;
  mediaType: 'IMAGE' | 'VIDEO';
  mediaUrl: string;
  thumbnailUrl?: string | null;
  displayOrder: number;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CmsWebsiteSettings {
  companyName?: string;
  tagline?: string;
  address?: string;
  phone?: string;
  email?: string;
  businessHours?: string;
  googleMapsUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  gstin?: string;
  fssaiLicense?: string;
  whatsappNumber?: string;
  phoneNumber?: string;
  defaultWhatsappMessage?: string;
  productWhatsappMessage?: string;
  whatsappEnabled?: boolean;
  floatingWhatsappEnabled?: boolean;
  productInquiryEnabled?: boolean;
}

export const websiteCmsApi = {
  getContent: async (section: string): Promise<any> => {
    const res = await apiClient.get<any>(`/cms/content/${section}`);
    return res.data;
  },

  updateContent: async (section: string, content: any): Promise<any> => {
    const res = await apiClient.put<any>(`/cms/content/${section}`, { content });
    return res.data;
  },

  getProducts: async (params?: {
    search?: string;
    categoryId?: string;
    isWebsiteVisible?: boolean;
  }): Promise<CmsProduct[]> => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    if (params?.isWebsiteVisible !== undefined)
      query.set('isWebsiteVisible', String(params.isWebsiteVisible));
    const qs = query.toString();
    const endpoint = qs ? `/cms/products?${qs}` : '/cms/products';
    const res = await apiClient.get<CmsProduct[]>(endpoint);
    return res.data;
  },

  updateProductVisibility: async (
    id: string,
    data: { isWebsiteVisible?: boolean; isFeatured?: boolean; description?: string; imageUrl?: string }
  ): Promise<any> => {
    const res = await apiClient.patch<any>(`/cms/products/${id}/visibility`, data);
    return res.data;
  },

  getGallery: async (): Promise<CmsGalleryItem[]> => {
    const res = await apiClient.get<CmsGalleryItem[]>('/cms/gallery');
    return res.data;
  },

  createGalleryItem: async (data: {
    title?: string;
    caption?: string;
    mediaType: 'IMAGE' | 'VIDEO';
    mediaUrl: string;
    thumbnailUrl?: string;
    displayOrder?: number;
    isVisible?: boolean;
  }): Promise<CmsGalleryItem> => {
    const res = await apiClient.post<CmsGalleryItem>('/cms/gallery', data);
    return res.data;
  },

  updateGalleryItem: async (
    id: string,
    data: Partial<CmsGalleryItem>
  ): Promise<CmsGalleryItem> => {
    const res = await apiClient.patch<CmsGalleryItem>(`/cms/gallery/${id}`, data);
    return res.data;
  },

  deleteGalleryItem: async (id: string): Promise<void> => {
    await apiClient.delete(`/cms/gallery/${id}`);
  },

  updateContactSettings: async (data: {
    address?: string;
    phone?: string;
    email?: string;
    businessHours?: string;
    googleMapsUrl?: string;
    instagramUrl?: string;
    youtubeUrl?: string;
    tagline?: string;
  }): Promise<any> => {
    const res = await apiClient.patch<any>('/cms/contact', data);
    return res.data;
  },

  getSettings: async (): Promise<CmsWebsiteSettings> => {
    const res = await apiClient.get<CmsWebsiteSettings>('/cms/settings');
    return res.data;
  },

  updateSettings: async (data: Partial<CmsWebsiteSettings>): Promise<CmsWebsiteSettings> => {
    const res = await apiClient.patch<CmsWebsiteSettings>('/cms/settings', data);
    return res.data;
  },

  uploadMedia: async (
    file: File
  ): Promise<{
    url: string;
    filename: string;
    originalName: string;
    size: number;
    mimetype: string;
    mediaType: 'IMAGE' | 'VIDEO';
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.upload<{
      url: string;
      filename: string;
      originalName: string;
      size: number;
      mimetype: string;
      mediaType: 'IMAGE' | 'VIDEO';
    }>('/cms/upload', formData);
    return res.data;
  },
};
