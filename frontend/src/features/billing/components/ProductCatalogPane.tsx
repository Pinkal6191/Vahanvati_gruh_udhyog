import React, { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { Search, X, Layers, Filter, RefreshCw, ShoppingBag } from 'lucide-react';
import { Product, ProductsApi } from '../../products/products.api';
import { Category, CategoriesApi } from '../../categories/categories.api';
import { Subcategory, SubcategoriesApi } from '../../subcategories/subcategories.api';
import { CustomerType } from '../../../types/common.types';
import { ProductCard } from './ProductCard';
import { LoadingState } from '../../../components/common/LoadingState/LoadingState';
import { EmptyState } from '../../../components/common/EmptyState/EmptyState';

export interface ProductCatalogPaneRef {
  focusSearch: () => void;
  clearSearch: () => void;
}

export interface ProductCatalogPaneProps {
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

export const ProductCatalogPane = forwardRef<ProductCatalogPaneRef, ProductCatalogPaneProps>(
  ({ customerType, onAddToCart }, ref) => {
    const searchInputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focusSearch: () => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      },
      clearSearch: () => {
        setSearchTerm('');
        searchInputRef.current?.focus();
      },
    }));

    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

    const [searchTerm, setSearchTerm] = useState<string>('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
    const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('ALL');

    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Initial Data Fetch
    const loadCatalogData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [prodRes, catRes, subRes] = await Promise.all([
          ProductsApi.list({ limit: 100, status: 'active' }),
          CategoriesApi.list({ status: 'active' }),
          SubcategoriesApi.list({ status: 'active' }),
        ]);

        setProducts(prodRes.items || []);
        setCategories(Array.isArray(catRes) ? catRes : (catRes as any).items || []);
        setSubcategories(Array.isArray(subRes) ? subRes : (subRes as any).items || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load product catalog. Please verify backend connection.');
      } finally {
        setIsLoading(false);
      }
    };

    useEffect(() => {
      loadCatalogData();
    }, []);

    // Filter subcategories dynamically by selected category
    const availableSubcategories = useMemo(() => {
      if (selectedCategoryId === 'ALL') return subcategories;
      return subcategories.filter((s) => s.categoryId === selectedCategoryId);
    }, [subcategories, selectedCategoryId]);

    // Client-side search and filtering for sub-second keyboard responsiveness
    const filteredProducts = useMemo(() => {
      const q = searchTerm.trim().toLowerCase();

      return products.filter((p) => {
        // Category Filter
        const productCatId =
          p.subcategory?.categoryId ||
          subcategories.find((s) => s.id === p.subcategoryId)?.categoryId;
        if (selectedCategoryId !== 'ALL' && productCatId !== selectedCategoryId) {
          return false;
        }

        // Subcategory Filter
        if (selectedSubcategoryId !== 'ALL' && p.subcategoryId !== selectedSubcategoryId) {
          return false;
        }

        // Text Search
        if (q) {
          const matchName = p.name.toLowerCase().includes(q);
          const matchGujarati = p.gujaratiName ? p.gujaratiName.toLowerCase().includes(q) : false;
          const matchCode = p.code.toLowerCase().includes(q);
          const matchBarcode = p.barcode ? p.barcode.toLowerCase().includes(q) : false;
          if (!matchName && !matchGujarati && !matchCode && !matchBarcode) {
            return false;
          }
        }

        return true;
      });
    }, [products, searchTerm, selectedCategoryId, selectedSubcategoryId]);

    return (
      <div className="pos-catalog-pane">
        {/* TOP SEARCH & CONTROLS */}
        <div className="pos-search-header">
          <div className="pos-search-bar">
            <Search size={18} className="pos-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="pos-search-input"
              placeholder="Search products by name, Gujarati, code (Ctrl+K)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoComplete="off"
              spellCheck="false"
            />
            {searchTerm && (
              <button
                type="button"
                className="pos-clear-search-btn"
                onClick={() => {
                  setSearchTerm('');
                  searchInputRef.current?.focus();
                }}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
            <kbd className="pos-kbd-hint">⌘K</kbd>
          </div>

          <button
            type="button"
            className="pos-refresh-btn"
            onClick={loadCatalogData}
            title="Refresh product list"
            aria-label="Refresh catalog"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* CATEGORY FILTER CHIPS */}
        <div className="pos-categories-carousel">
          <button
            type="button"
            className={`pos-category-chip ${selectedCategoryId === 'ALL' ? 'active' : ''}`}
            onClick={() => {
              setSelectedCategoryId('ALL');
              setSelectedSubcategoryId('ALL');
            }}
          >
            <Layers size={14} />
            <span>All Products ({products.length})</span>
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`pos-category-chip ${selectedCategoryId === cat.id ? 'active' : ''}`}
              onClick={() => {
                setSelectedCategoryId(cat.id);
                setSelectedSubcategoryId('ALL');
              }}
            >
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        {/* SUBCATEGORY SECONDARY FILTER (IF APPLICABLE) */}
        {availableSubcategories.length > 0 && selectedCategoryId !== 'ALL' && (
          <div className="pos-subcategories-bar">
            <span className="pos-subcat-label">Subcategory:</span>
            <select
              className="pos-subcat-select"
              value={selectedSubcategoryId}
              onChange={(e) => setSelectedSubcategoryId(e.target.value)}
            >
              <option value="ALL">All Subcategories</option>
              {availableSubcategories.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* PRODUCT GRID / RESULTS AREA */}
        <div className="pos-grid-container">
          {isLoading && products.length === 0 ? (
            <div className="pos-catalog-loading">
              <LoadingState message="Loading catalog..." size="md" />
            </div>
          ) : error ? (
            <div className="pos-catalog-error">
              <p className="pos-error-text">{error}</p>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={loadCatalogData}
              >
                Retry
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="pos-catalog-empty">
              <EmptyState
                icon={<ShoppingBag size={42} />}
                title="No Products Found"
                description={
                  searchTerm
                    ? `No product matches "${searchTerm}". Try a different name, code, or clear search.`
                    : 'No active products in this category.'
                }
                action={
                  searchTerm
                    ? {
                        label: 'Clear Search',
                        onClick: () => setSearchTerm(''),
                      }
                    : undefined
                }
              />
            </div>
          ) : (
            <div className="pos-product-grid">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  customerType={customerType}
                  onAddToCart={onAddToCart}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);

ProductCatalogPane.displayName = 'ProductCatalogPane';
