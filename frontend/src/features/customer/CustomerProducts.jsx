import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiGet } from "../../lib/api";
import { API_URL } from "../../lib/config";
import { Search, ShoppingCart, Image as ImageIcon, Plus, Minus, X, Package, ChevronDown } from "lucide-react";
import Breadcrumb from "../../components/Breadcrumb";
import { useToast, ToastContainer } from "../../components/Toast";

// Product Image Component
function ProductImage({ imageUrl, alt, category }) {
  const [imgError, setImgError] = useState(false);
  
  let normalizedUrl = imageUrl;
  if (imageUrl && imageUrl.startsWith("/uploads/products/")) {
    normalizedUrl = imageUrl.replace("/uploads/products/", "/api/files/products/");
  }
  
  const imageSrc = imageUrl && !imgError
    ? (normalizedUrl.startsWith("http") 
        ? normalizedUrl 
        : normalizedUrl.startsWith("/") 
          ? `${API_URL}${normalizedUrl}`
          : `${API_URL}/${normalizedUrl}`)
    : null;
  
  return (
    <div className="relative w-full h-56 bg-slate-800/50 rounded-t-xl overflow-hidden flex items-center justify-center">
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <ImageIcon className="w-16 h-16 text-slate-600" />
      )}
      {category && (
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-slate-900/90 backdrop-blur-sm text-xs font-semibold text-slate-200 uppercase tracking-wide">
          {category}
        </div>
      )}
    </div>
  );
}

// Product Card Component with Quantity Selector
function ProductCard({ product, cartQuantity, onAddToCart, onNavigate }) {
  const [quantity, setQuantity] = useState(1);

  function fmtGBP(n) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 2,
    }).format(n || 0);
  }

  return (
    <div className="group bg-slate-900/60 backdrop-blur rounded-xl border border-slate-800 shadow-lg overflow-hidden hover:border-slate-700 hover:shadow-xl transition-all flex flex-col">
      <div onClick={onNavigate} className="cursor-pointer">
        <ProductImage
          imageUrl={product.imageUrl}
          alt={product.name}
          category={product.category}
        />
        <div className="p-5 flex flex-col flex-1 space-y-3">
          {/* Product Name */}
          <h3 className="font-semibold text-slate-100 text-base leading-tight line-clamp-2 min-h-[2.5rem]">
            {product.name}
          </h3>
          
          {/* Description */}
          {product.description && product.description.trim() ? (
            <p className="text-sm text-slate-400 line-clamp-2 min-h-[2.5rem]">
              {product.description}
            </p>
          ) : (
            <div className="min-h-[2.5rem]"></div>
          )}
          
          {/* Spacer */}
          <div className="flex-1"></div>
        </div>
      </div>
      
      <div className="px-5 pb-5 pt-0 border-t border-slate-800/50">
        {/* Price & Stock */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">
              {fmtGBP(product.price || 0)}
            </span>
            {product.currentStock !== undefined && (
              <span className="text-xs text-slate-500">
                Stock: {product.currentStock}
              </span>
            )}
          </div>
          {cartQuantity > 0 && (
            <div className="px-2 py-1 rounded-md bg-sky-600/20 text-sky-300 text-xs font-medium">
              {cartQuantity} in cart
            </div>
          )}
        </div>
        
        {/* Quantity Selector & Add Button - Side by Side */}
        <div className="flex items-center gap-2">
          {/* Quantity Selector */}
          <div className="flex items-center gap-1 flex-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setQuantity(Math.max(1, quantity - 1));
              }}
              disabled={quantity <= 1}
              className="w-8 h-8 p-0 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 flex items-center justify-center"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <input
              type="number"
              min="1"
              max={product.currentStock !== undefined ? product.currentStock : 9999}
              value={quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                const max = product.currentStock !== undefined ? product.currentStock : 9999;
                setQuantity(Math.max(1, Math.min(max, val)));
              }}
              onClick={(e) => e.stopPropagation()}
              disabled={!product.isActive || (product.currentStock !== undefined && product.currentStock <= 0)}
              className="w-12 px-1 py-1.5 text-sm text-center rounded-lg border border-slate-700 bg-slate-900 text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500/50 disabled:opacity-50 disabled:cursor-not-allowed h-8"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const max = product.currentStock !== undefined ? product.currentStock : 9999;
                setQuantity(Math.min(max, quantity + 1));
              }}
              disabled={!product.isActive || (product.currentStock !== undefined && product.currentStock <= 0) || (product.currentStock !== undefined && quantity >= product.currentStock)}
              className="w-8 h-8 p-0 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 flex items-center justify-center"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          
          {/* Add Button - Small on the right */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(quantity);
              setQuantity(1); // Reset to 1 after adding
            }}
            disabled={!product.isActive || (product.currentStock !== undefined && product.currentStock <= 0)}
            className="h-8 px-3 py-0 rounded-lg bg-sky-600/80 hover:bg-sky-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 flex-shrink-0"
          >
            <ShoppingCart className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function fmtGBP(n) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(n || 0);
}

export default function CustomerProducts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast, toasts, removeToast } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState([]);

  const cartRef = useRef([]);

  // Load cart from localStorage
  const loadCart = useCallback(() => {
    const savedCart = localStorage.getItem("customerCart");
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        const currentStr = JSON.stringify(cartRef.current);
        const newStr = JSON.stringify(parsedCart);
        if (currentStr !== newStr) {
          setCart(parsedCart);
          cartRef.current = parsedCart;
        }
      } catch (e) {
        console.error("Failed to load cart:", e);
      }
    } else {
      // If no cart in localStorage, only clear state if we had items before
      if (cartRef.current.length > 0) {
        setCart([]);
        cartRef.current = [];
      }
    }
  }, []);

  // Load cart on mount and when location changes
  useEffect(() => {
    loadCart();
  }, [location.pathname, loadCart]);

  // Listen for storage events and cartUpdated events
  useEffect(() => {
    const handleCartUpdate = () => {
      loadCart();
    };
    
    window.addEventListener("storage", handleCartUpdate);
    window.addEventListener("cartUpdated", handleCartUpdate);
    
    return () => {
      window.removeEventListener("storage", handleCartUpdate);
      window.removeEventListener("cartUpdated", handleCartUpdate);
    };
  }, [loadCart]);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    // Only save if cart actually changed
    const currentStr = JSON.stringify(cartRef.current);
    const newStr = JSON.stringify(cart);
    if (currentStr === newStr) {
      return;
    }
    
    cartRef.current = cart;
    localStorage.setItem("customerCart", JSON.stringify(cart));
    
    // Dispatch event to notify other components
    window.dispatchEvent(new Event("cartUpdated"));
  }, [cart]);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  async function loadProducts() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("pageSize", "100");
      params.set("isActive", "true"); // Only show active products
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (q.trim()) params.set("q", q.trim());

      const data = await apiGet(`/api/products?${params.toString()}`);
      setProducts(data.items || []);
    } catch (e) {
      console.error("Failed to load products:", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const cats = await apiGet("/api/products/categories");
      setCategories(Array.isArray(cats) ? cats : []);
    } catch {}
  }

  useEffect(() => {
    loadProducts();
  }, [categoryFilter, q]);

  function getProductQuantity(productId) {
    // Always read from localStorage to get the latest cart state
    const savedCart = localStorage.getItem("customerCart");
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        const item = parsedCart.find((item) => item.productId === productId);
        return item ? item.quantity : 0;
      } catch (e) {
        console.error("Failed to parse cart:", e);
      }
    }
    // Fallback to state
    const item = cart.find((item) => item.productId === productId);
    return item ? item.quantity : 0;
  }

  function addToCart(product, quantity = 1) {
    if (!product.isActive) {
      showToast("This product is not available", "error");
      return;
    }

    if (product.currentStock !== undefined && product.currentStock <= 0) {
      showToast("This product is out of stock", "error");
      return;
    }

    const qty = Math.max(1, parseInt(quantity) || 1);
    
    // Load current cart from localStorage to ensure we have the latest
    const savedCart = localStorage.getItem("customerCart");
    let currentCart = [];
    if (savedCart) {
      try {
        currentCart = JSON.parse(savedCart);
      } catch (e) {
        console.error("Failed to parse cart:", e);
      }
    }
    
    const existingIndex = currentCart.findIndex((item) => item.productId === product._id);
    
    const imageUrl = product.imageUrl?.startsWith("/uploads/products/")
      ? `/api/files/products/${product.imageUrl.split("/").pop()}`
      : product.imageUrl;
    
    let newCart;
    if (existingIndex >= 0) {
      // Update quantity
      newCart = [...currentCart];
      newCart[existingIndex].quantity += qty;
      newCart[existingIndex].subtotal = newCart[existingIndex].quantity * newCart[existingIndex].price;
    } else {
      // Add new item
      newCart = [
        ...currentCart,
        {
          productId: product._id,
          productName: product.name,
          name: product.name,
          price: product.price || 0,
          quantity: qty,
          subtotal: qty * (product.price || 0),
          imageUrl: imageUrl,
        },
      ];
    }
    
    // Update state and localStorage
    setCart(newCart);
    localStorage.setItem("customerCart", JSON.stringify(newCart));
    window.dispatchEvent(new Event("cartUpdated"));
    showToast(`${qty} x ${product.name} added to cart`, "success");
  }


  // Calculate cart item count from localStorage for accurate count
  const cartItemCount = (() => {
    const savedCart = localStorage.getItem("customerCart");
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        return parsedCart.reduce((sum, item) => sum + (item.quantity || 0), 0);
      } catch (e) {
        return cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
      }
    }
    return cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
  })();

  return (
    <div className="max-w-6xl mx-auto">
      <Breadcrumb
        items={[{ label: "Products" }]}
        actionButton={
          <button
            onClick={() => navigate("/customer/cart")}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-600/80 hover:bg-sky-600 text-white text-sm font-medium transition-colors relative"
          >
            <ShoppingCart className="w-4 h-4" />
            Cart
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-bold min-w-[20px] text-center">
                {cartItemCount}
              </span>
            )}
          </button>
        }
      />

      <h1 className="text-2xl font-bold text-slate-100 mb-6">Products</h1>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Left side: Category Filter */}
        <div className="relative w-full sm:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600 focus:border-transparent w-full sm:w-48 cursor-pointer"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        {/* Right side: Search */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadProducts();
          }}
          className="flex gap-2 w-full sm:w-auto"
        >
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products..."
              className="pl-10 pr-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-600 focus:border-transparent w-full sm:w-64"
            />
          </div>
          <button
            type="submit"
            className="p-2 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition-colors"
            title="Search"
          >
            <Search className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="text-center text-slate-400 py-12">Loading products...</div>
      ) : products.length === 0 ? (
        <div className="text-center text-slate-400 py-12">
          <Package className="w-16 h-16 mx-auto mb-3 text-slate-500" />
          <div className="text-sm">No products found</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => {
            const cartQuantity = getProductQuantity(product._id);
            return (
              <ProductCard
                key={product._id}
                product={product}
                cartQuantity={cartQuantity}
                onAddToCart={(qty) => addToCart(product, qty)}
                onNavigate={() => navigate(`/customer/products/${product._id}`)}
              />
            );
          })}
        </div>
      )}

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
