import { prisma } from '../../config/database.js';

export class SettingsService {
  static async getCompanySettings() {
    let settings = await prisma.companySettings.findFirst();
    if (!settings) {
      settings = await prisma.companySettings.create({
        data: {
          companyName: 'Vahanvati Gruh Udhyog',
          address: 'Ahmedabad, Gujarat',
          phone: '+91 98250 00000',
        },
      });
    }
    return settings;
  }

  static async updateCompanySettings(data: any) {
    const existing = await this.getCompanySettings();
    return prisma.companySettings.update({
      where: { id: existing.id },
      data,
    });
  }
}
