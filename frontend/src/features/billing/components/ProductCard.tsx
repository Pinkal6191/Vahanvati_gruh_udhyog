import React, { useState } from 'react';
import { Package, AlertTriangle, PackageX, Plus } from 'lucide-react';
import { Product } from '../../products/products.api';
import { CustomerType } from '../../../types/common.types';
import { formatCurrency, formatGramsToKg } from '../../../utils/formatters';

export interface ProductCardProps {
  product: Product;
  customerType: CustomerType;
  onAddToCart: (
    product: Product,
    options?: {
      packConfigId?: string | null;
      packName?: string | null;
      quantity?: number;
      looseWeightInGrams?: number | null;
    }
  ) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  customerType,
  onAddToCart,
}) => {
  const stockBalance = product.stock?.currentBalance ?? 0;
  const isOutOfStock = stockBalance <= 0;
  const isLowStock = stockBalance > 0 && stockBalance <= (product.stock?.minimumThreshold ?? 1000);

  // Applicable Price
  const applicableRate =
    (customerType === 'NRI' ? product.nriPrice : product.indianPrice) ?? 0;

  // Packs
  const packs = product.packConfigurations || [];
  const [selectedPackId, setSelectedPackId] = useState<string>('');

  const handleCardClick = () => {
    if (packs.length > 0 && selectedPackId) {
      const selectedPack = packs.find((p) => p.id === selectedPackId);
      onAddToCart(product, {
        packConfigId: selectedPack?.id,
        packName: selectedPack?.packName,
        looseWeightInGrams: selectedPack?.weightInBaseUnits,
      });
    } else {
      onAddToCart(product);
    }
  };

  return (
    <div
      className={`pos-product-card ${isOutOfStock ? 'is-out-of-stock' : ''}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      aria-label={`Add ${product.name} to cart`}
    >
      <div className="pos-card-header">
        <div className="pos-card-title-group">
          <h4 className="pos-product-name">{product.name}</h4>
          {product.gujaratiName && (
            <span className="pos-product-gujarati">{product.gujaratiName}</span>
          )}
        </div>
        <span className="pos-product-code">{product.code}</span>
      </div>

      <div className="pos-card-meta">
        <span className="pos-category-tag">
          {product.subcategory?.name || 'General'}
        </span>
        {product.primaryUnit && (
          <span className="pos-unit-tag">{product.primaryUnit.symbol}</span>
        )}
      </div>

      {packs.length > 0 && (
        <div
          className="pos-pack-selector"
          onClick={(e) => e.stopPropagation()}
        >
          <select
            className="pos-pack-select"
            value={selectedPackId}
            onChange={(e) => setSelectedPackId(e.target.value)}
            aria-label="Select pack size"
          >
            <option value="">Standard ({product.primaryUnit?.symbol || 'unit'})</option>
            {packs.map((pk) => (
              <option key={pk.id} value={pk.id}>
                {pk.packName} ({formatGramsToKg(pk.weightInBaseUnits)})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="pos-card-footer">
        <div className="pos-price-block">
          <span className="pos-currency-symbol">₹</span>
          <span className="pos-price-amount">{applicableRate.toFixed(2)}</span>
          <span className="pos-price-tier">({customerType})</span>
        </div>

        <div className="pos-stock-badge-wrapper">
          {isOutOfStock ? (
            <span className="pos-stock-badge out-of-stock">
              <PackageX size={12} />
              <span>Out of Stock</span>
            </span>
          ) : isLowStock ? (
            <span className="pos-stock-badge low-stock">
              <AlertTriangle size={12} />
              <span>{formatGramsToKg(stockBalance)}</span>
            </span>
          ) : (
            <span className="pos-stock-badge in-stock">
              <Package size={12} />
              <span>{formatGramsToKg(stockBalance)}</span>
            </span>
          )}
        </div>

        <button
          type="button"
          className="pos-quick-add-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleCardClick();
          }}
          title="Add to cart"
          aria-label="Add to cart"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
};
