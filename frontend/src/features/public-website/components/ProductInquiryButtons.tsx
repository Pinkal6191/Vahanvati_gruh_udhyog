import React from 'react';
import { Phone, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PublicProduct } from '../public-website.api';
import { usePublicSettings } from '../hooks/usePublicSettings';
import {
  buildWhatsAppInquiryUrl,
  cleanPhoneNumberForTel,
} from '../services/whatsapp.utils';

interface ProductInquiryButtonsProps {
  product: PublicProduct;
  layout?: 'card' | 'detail';
}

export const ProductInquiryButtons: React.FC<ProductInquiryButtonsProps> = ({
  product,
  layout = 'card',
}) => {
  const { settings } = usePublicSettings();

  const isWhatsAppEnabled =
    settings?.whatsappEnabled !== false && settings?.productInquiryEnabled !== false;

  const whatsappNumber = settings?.whatsappNumber || '919714917851';
  const productMessageTemplate =
    settings?.productWhatsappMessage ||
    'Hello Vahanvati Gruh Udhyog, I am interested in {productName}. Please share more details and pricing.';

  const whatsappUrl = buildWhatsAppInquiryUrl(
    whatsappNumber,
    productMessageTemplate,
    product.name,
    product.gujaratiName
  );

  const phone = settings?.phoneNumber || settings?.phone || '+91 97149 17851';
  const telHref = cleanPhoneNumberForTel(phone);

  if (layout === 'detail') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {isWhatsAppEnabled && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="public-btn-whatsapp-detail"
            aria-label={`Enquire about ${product.name} on WhatsApp`}
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.187-2.59-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.275.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.043.073.043.419-.101.824zM12 2C6.477 2 2 6.477 2 12c0 1.891.524 3.662 1.435 5.176L2 22l4.981-1.309A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.2a8.16 8.16 0 01-4.398-1.272l-.315-.187-2.96.776.79-2.885-.205-.327A8.162 8.162 0 013.8 12c0-4.521 3.679-8.2 8.2-8.2 4.521 0 8.2 3.679 8.2 8.2 0 4.521-3.679 8.2-8.2 8.2z" />
            </svg>
            <span>Enquire on WhatsApp</span>
          </a>
        )}

        <a
          href={telHref}
          className="public-contact-action-btn call"
          style={{ textAlign: 'center', textDecoration: 'none' }}
          aria-label={`Call to inquire about ${product.name}`}
        >
          <Phone size={18} />
          <span>Call Now: {phone.split('/')[0].trim()}</span>
        </a>
      </div>
    );
  }

  // Card layout
  return (
    <div className="public-card-footer-box">
      <div className="public-card-meta-row">
        <span className="public-product-pack-tag">
          Unit: {product.primaryUnit?.symbol || product.primaryUnit?.name || 'Pack'}
        </span>
        <Link
          to={`/products/${product.id}`}
          className="public-card-details-link"
          title={`View full details of ${product.name}`}
        >
          <span>Details</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      <div className="public-card-buttons-row">
        {isWhatsAppEnabled && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="public-btn-whatsapp-sm"
            title={`Enquire about ${product.name} on WhatsApp`}
            aria-label={`Enquire about ${product.name} on WhatsApp`}
          >
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.187-2.59-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.275.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.043.073.043.419-.101.824zM12 2C6.477 2 2 6.477 2 12c0 1.891.524 3.662 1.435 5.176L2 22l4.981-1.309A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.2a8.16 8.16 0 01-4.398-1.272l-.315-.187-2.96.776.79-2.885-.205-.327A8.162 8.162 0 013.8 12c0-4.521 3.679-8.2 8.2-8.2 4.521 0 8.2 3.679 8.2 8.2 0 4.521-3.679 8.2-8.2 8.2z" />
            </svg>
            <span>WhatsApp</span>
          </a>
        )}

        <a
          href={telHref}
          className="public-btn-call-sm"
          title={`Call store directly: ${phone}`}
          aria-label={`Call to inquire about ${product.name}`}
        >
          <Phone size={13} />
          <span>Call</span>
        </a>
      </div>
    </div>
  );
};
