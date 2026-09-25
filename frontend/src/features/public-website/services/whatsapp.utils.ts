/**
 * WhatsApp and Phone Direct Call Utilities
 * Vahanvati Gruh Udhyog
 */

export function cleanPhoneNumberForWhatsApp(phone?: string | null): string {
  if (!phone) return '919714917851';
  let digits = String(phone).replace(/[^\d]/g, '');
  if (!digits) return '919714917851';
  // If 10 digits without country code (e.g. 9714917851), prepend India code 91
  if (digits.length === 10) {
    digits = `91${digits}`;
  }
  return digits;
}

export function cleanPhoneNumberForTel(phone?: string | null): string {
  if (!phone) return '+919714917851';
  // If multiple numbers separated by / or comma, take the first one
  const first = String(phone).split('/')[0].split(',')[0].trim();
  const digits = first.replace(/[^\d+]/g, '');
  if (!digits) return '+919714917851';
  if (!digits.startsWith('+') && digits.length === 10) {
    return `+91${digits}`;
  }
  return digits;
}

export function buildWhatsAppInquiryUrl(
  whatsappNumber?: string | null,
  messageTemplate?: string | null,
  productName?: string | null,
  gujaratiName?: string | null
): string {
  const number = cleanPhoneNumberForWhatsApp(whatsappNumber);
  let template =
    messageTemplate ||
    'Hello Vahanvati Gruh Udhyog, I am interested in {productName}. Please share more details and pricing.';

  if (productName) {
    const formattedName = gujaratiName ? `${productName} (${gujaratiName})` : productName;
    template = template.replace(/\{productName\}/g, formattedName);
  } else {
    template =
      messageTemplate || 'Hello Vahanvati Gruh Udhyog, I would like to know more about your products.';
  }

  return `https://wa.me/${number}?text=${encodeURIComponent(template)}`;
}
