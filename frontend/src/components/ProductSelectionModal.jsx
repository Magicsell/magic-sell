import { useState, useEffect, useMemo } from "react";
import { apiGet } from "../lib/api";
import { API_URL } from "../lib/config";
import { X, Search, Image as ImageIcon, Plus, Minus, Check } from "lucide-react";

function ProductImage({ imageUrl, alt }) {
  const [imgError, setImgError] = useState(false);
  
  if (!imageUrl || imgError) {
    return (
      <div className="w-full h-40 rounded-lg border border-slate-700 bg-slate-800/50 flex items-center justify-center">
        <ImageIcon className="w-10 h-10 text-slate-500" />
      </div>
    );
  }
  
  // Normalize image URL
  let normalizedUrl = imageUrl;
  if (imageUrl.startsWith("/uploads/products/")) {
    normalizedUrl = imageUrl.replace("/uploads/products/", "/api/files/products/");
  }
  
  const imageSrc = normalizedUrl.startsWith("http") || normalizedUrl.startsWith("data:")
    ? normalizedUrl 
    : normalizedUrl.startsWith("/") 
      ? `${API_URL}${normalizedUrl}`
      : `${API_URL}/${normalizedUrl}`;
  
  return (
    <img
      src={imageSrc}
      alt={alt}
      className="w-full h-40 object-cover rounded-lg border border-slate-700"
      onError={() => setImgError(true)}
    />
  );
}

export default function ProductSelectionModal({ open, onClose, onAddProduct, existingProductIds = [] }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProducts, setSelectedProducts] = useState({}); // { productId: quantity }

  // Fetch products and categories
  useEffect(() => {
    if (!open) return;
    
    setLoading(true);
    Promise.all([
      apiGet("/api/products?isActive=true&pageSize=100"),
      apiGet("/api/products/categories"),
    ])
      .then(([productsData, categoriesData]) => {
        const productsList = Array.isArray(productsData) ? productsData : productsData.items ?? [];
        setProducts(productsList);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      })
      .catch((e) => {
        console.error("Failed to fetch products:", e);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedCategory("all");
      setSelectedProducts({});
    }
  }, [open]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Search filter
      const matchesSearch =
        !searchQuery.trim() ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (product.brand && product.brand.toLowerCase().includes(searchQuery.toLowerCase()));

      // Category filter
      const matchesCategory =
        selectedCategory === "all" ||
        (selectedCategory === "uncategorized" && !product.category) ||
        product.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Update quantity
  function updateQuantity(productId, delta) {
    setSelectedProducts((prev) => {
      const current = prev[productId] || 0;
      const newQty = Math.max(0, current + delta);
      if (newQty === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: newQty };
    });
  }

  function setQuantity(productId, quantity) {
    // Remove leading zeros and convert to number
    let qty = quantity;
    if (typeof quantity === "string") {
      // Remove leading zeros: "010" -> "10", "00" -> "0"
      qty = quantity.replace(/^0+/, "") || "0";
      qty = Number(qty) || 0;
    } else {
      qty = Number(quantity) || 0;
    }
    
    qty = Math.max(0, qty);
    
    if (qty === 0) {
      setSelectedProducts((prev) => {
        const { [productId]: _, ...rest } = prev;
        return rest;
      });
    } else {
      setSelectedProducts((prev) => ({ ...prev, [productId]: qty }));
    }
  }

  // Add selected products to order
  function handleAddToOrder() {
    const itemsToAdd = Object.entries(selectedProducts)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, quantity]) => {
        const product = products.find((p) => p._id === productId);
        return {
          productId,
          productName: product?.name || "",
          quantity: Number(quantity),
          price: product?.price || 0,
          subtotal: (product?.price || 0) * Number(quantity),
          imageUrl: product?.imageUrl || null, // Include image URL
        };
      });

    if (itemsToAdd.length > 0) {
      itemsToAdd.forEach((item) => onAddProduct(item));
      onClose();
    }
  }

  const totalSelected = Object.values(selectedProducts).reduce((sum, qty) => sum + qty, 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="relative z-10 w-full max-w-5xl max-h-[calc(100vh-2rem)] bg-slate-900 rounded-xl border border-slate-800 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Select Products</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {totalSelected > 0 ? `${totalSelected} product(s) selected` : "Choose products to add to order"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-slate-800 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800/50 text-slate-100 text-sm border border-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all"
            />
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400">Category:</span>
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                selectedCategory === "all"
                  ? "bg-sky-600/80 text-white"
                  : "bg-slate-800/50 text-slate-300 hover:bg-slate-800"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  selectedCategory === cat
                    ? "bg-sky-600/80 text-white"
                    : "bg-slate-800/50 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {cat}
              </button>
            ))}
            <button
              onClick={() => setSelectedCategory("uncategorized")}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                selectedCategory === "uncategorized"
                  ? "bg-sky-600/80 text-white"
                  : "bg-slate-800/50 text-slate-300 hover:bg-slate-800"
              }`}
            >
              Uncategorized
            </button>
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <p className="text-base">No products found</p>
              <p className="text-xs mt-1 text-slate-500">Try adjusting your search or category filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredProducts.map((product) => {
                const quantity = selectedProducts[product._id] || 0;
                const isSelected = quantity > 0;

                return (
                  <div
                    key={product._id}
                    className={`relative rounded-lg border transition-all flex flex-col ${
                      isSelected
                        ? "border-sky-500 bg-sky-500/10 shadow-lg shadow-sky-500/20"
                        : "border-slate-700 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50"
                    }`}
                  >
                    {/* Product Image */}
                    <div className="p-2">
                      <ProductImage imageUrl={product.imageUrl} alt={product.name} />
                    </div>

                    {/* Product Info */}
                    <div className="p-3 flex flex-col flex-1 space-y-2">
                      <div className="flex-1">
                        <h3 className="font-medium text-slate-100 text-xs line-clamp-2 min-h-[2rem]">
                          {product.name}
                        </h3>
                        {product.category && (
                          <p className="text-xs text-slate-500 mt-1">{product.category}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-100">
                          £{Number(product.price || 0).toFixed(2)}
                        </span>
                        {product.stock?.trackStock && (
                          <span className="text-xs text-slate-500">
                            {product.stock.quantity} in stock
                          </span>
                        )}
                      </div>

                      {/* Quantity Selector */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => updateQuantity(product._id, -1)}
                          disabled={quantity === 0}
                          className="p-1.5 rounded border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          max="9999"
                          value={quantity || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || val === "0") {
                              setQuantity(product._id, val);
                            } else {
                              setQuantity(product._id, val.replace(/^0+/, "") || "0");
                            }
                          }}
                          onBlur={(e) => {
                            if (e.target.value === "" || e.target.value === "0") {
                              setQuantity(product._id, 0);
                            }
                          }}
                          className="flex-1 px-2 py-1.5 text-xs text-center rounded border border-slate-700 bg-slate-900 text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500/50 h-[32px]"
                        />
                        <button
                          type="button"
                          onClick={() => updateQuantity(product._id, 1)}
                          className="p-1.5 rounded border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 transition-colors flex-shrink-0"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Selected Indicator */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-sky-600 flex items-center justify-center shadow-lg">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-800/40">
          <div className="text-xs text-slate-400">
            {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} found
            {totalSelected > 0 && ` • ${totalSelected} selected`}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAddToOrder}
              disabled={totalSelected === 0}
              className="px-4 py-2 rounded-lg bg-sky-600/80 text-white font-medium hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              Add {totalSelected > 0 ? `${totalSelected} ` : ""}to Order
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

