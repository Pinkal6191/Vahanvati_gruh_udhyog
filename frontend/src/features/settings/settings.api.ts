import { apiClient } from '../../services/api/api-client';

export interface CompanySettings {
  id: string;
  companyName: string;
  tagline: string | null;
  address: string;
  phone: string;
  gstin: string | null;
  fssaiLicense: string | null;
  invoicePrefix: string;
  invoiceFooterNotes: string | null;
  printFormat: string;
  allowNegativeStock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateCompanySettingsInput {
  companyName?: string;
  tagline?: string | null;
  address?: string;
  phone?: string;
  gstin?: string | null;
  fssaiLicense?: string | null;
  invoicePrefix?: string;
  invoiceFooterNotes?: string | null;
  printFormat?: string;
  allowNegativeStock?: boolean;
}

export const SettingsApi = {
  get: async (): Promise<CompanySettings> => {
    const res = await apiClient.get<CompanySettings>('/settings');
    return (res as any).data;
  },
  update: async (data: UpdateCompanySettingsInput): Promise<CompanySettings> => {
    const res = await apiClient.patch<CompanySettings>('/settings', data);
    return (res as any).data;
  },
};
