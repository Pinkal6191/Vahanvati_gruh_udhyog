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

  // Check if product is Masala category/item
  const isMasala =
    product.subcategory?.category?.code === 'CAT_MASALA' ||
    product.subcategory?.code?.includes('MASALA') ||
    product.subcategory?.name?.includes('મસાલા') ||
    product.name?.includes('મસાલો') ||
    product.name?.includes('મસાલા') ||
    product.code?.startsWith('MASALA');

  // Fast-touch weight presets
  // Masala: 100g, 200g, 500g, 1 kg
  // Others: 500g, 1 kg
  const weightOptions = isMasala
    ? [
        { label: '100g', grams: 100 },
        { label: '200g', grams: 200 },
        { label: '500g', grams: 500 },
        { label: '1 kg', grams: 1000 },
      ]
    : [
        { label: '500g', grams: 500 },
        { label: '1 kg', grams: 1000 },
      ];

  // Default selection: 100g for Masala, 500g for others
  const [selectedWeightGrams, setSelectedWeightGrams] = useState<number>(
    isMasala ? 100 : 500
  );

  // Loose / base per-kg rate
  const looseRate = (customerType === 'NRI' ? product.nriPrice : product.indianPrice) ?? 0;

  // Packs matching selected weight
  const packs = product.packConfigurations || [];
  const matchingPack = packs.find((p) => p.weightInBaseUnits === selectedWeightGrams);

  // Pack price record if available
  const packPriceRecord = matchingPack
    ? ((product as any).prices || []).find(
        (pr: any) =>
          pr.packConfigId === matchingPack.id &&
          pr.customerType === customerType &&
          pr.isActive
      )
    : null;

  // Calculated rate for current selected weight
  const packRate = packPriceRecord ? Number(packPriceRecord.rate) : null;
  const applicableRate =
    packRate !== null && packRate > 0
      ? packRate
      : (selectedWeightGrams / 1000) * looseRate;

  const hasConfiguredPrice = looseRate > 0 || (packRate !== null && packRate > 0);

  const selectedOpt = weightOptions.find((o) => o.grams === selectedWeightGrams);

  const handleAddToCart = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!hasConfiguredPrice || isOutOfStock) return;

    const label = selectedOpt ? selectedOpt.label : `${selectedWeightGrams}g`;

    onAddToCart(product, {
      packConfigId: matchingPack?.id || null,
      packName: label,
      looseWeightInGrams: selectedWeightGrams,
      quantity: 1,
    });
  };

  const handleOptionClick = (grams: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedWeightGrams === grams) {
      // Tap again on active weight adds directly to cart!
      handleAddToCart();
    } else {
      setSelectedWeightGrams(grams);
    }
  };

  return (
    <div
      className={`pos-product-card ${isOutOfStock ? 'is-out-of-stock' : ''} ${!hasConfiguredPrice ? 'is-unpriced' : ''}`}
      onClick={() => handleAddToCart()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleAddToCart();
        }
      }}
      aria-label={`Add ${product.name} (${selectedOpt?.label}) to cart`}
    >
      <div className="pos-card-header">
        <div className="pos-card-title-group">
          <h4 className="pos-product-name" title={product.name}>{product.name}</h4>
          {product.gujaratiName && (
            <span className="pos-product-gujarati" title={product.gujaratiName}>{product.gujaratiName}</span>
          )}
        </div>
        <span className="pos-product-code" title={product.code}>{product.code}</span>
      </div>

      <div className="pos-card-meta">
        <span className="pos-category-tag" title={product.subcategory?.name || 'General'}>
          {product.subcategory?.name || 'General'}
        </span>
        {product.primaryUnit && (
          <span className="pos-unit-tag">{product.primaryUnit.symbol}</span>
        )}
      </div>

      {/* FAST-TOUCH WEIGHT BUTTONS (NO DROPDOWN) */}
      <div className="pos-weight-selector" onClick={(e) => e.stopPropagation()}>
        {weightOptions.map((opt) => {
          const isActive = selectedWeightGrams === opt.grams;
          return (
            <button
              key={opt.grams}
              type="button"
              className={`pos-weight-chip-btn ${isActive ? 'active' : ''}`}
              onClick={(e) => handleOptionClick(opt.grams, e)}
              title={isActive ? `Selected ${opt.label} (tap again to add)` : `Select ${opt.label}`}
              aria-pressed={isActive}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="pos-card-footer">
        <div className="pos-price-block">
          {hasConfiguredPrice ? (
            <>
              <span className="pos-currency-symbol">₹</span>
              <span className="pos-price-amount">{applicableRate.toFixed(2)}</span>
              <span className="pos-price-weight-tag">/{selectedOpt?.label || 'unit'}</span>
            </>
          ) : (
            <span className="pos-no-price-badge" title="Price not configured in system">
              Price Not Set
            </span>
          )}
        </div>

        <div className="pos-stock-badge-wrapper">
          {isOutOfStock ? (
            <span className="pos-stock-badge out-of-stock" title="Out of Stock">
              <PackageX size={12} />
              <span>Out of Stock</span>
            </span>
          ) : isLowStock ? (
            <span className="pos-stock-badge low-stock" title={`Low Stock: ${formatGramsToKg(stockBalance)}`}>
              <AlertTriangle size={12} />
              <span>{formatGramsToKg(stockBalance)}</span>
            </span>
          ) : (
            <span className="pos-stock-badge in-stock" title={`In Stock: ${formatGramsToKg(stockBalance)}`}>
              <Package size={12} />
              <span>{formatGramsToKg(stockBalance)}</span>
            </span>
          )}
        </div>

        <button
          type="button"
          className="pos-quick-add-btn"
          disabled={!hasConfiguredPrice || isOutOfStock}
          onClick={(e) => handleAddToCart(e)}
          title={!hasConfiguredPrice ? 'Price not configured' : `Add ${selectedOpt?.label} to cart`}
          aria-label="Add to cart"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
};
