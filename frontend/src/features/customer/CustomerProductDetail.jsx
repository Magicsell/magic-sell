import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGet } from "../../lib/api";
import { API_URL } from "../../lib/config";
import { ArrowLeft, ShoppingCart, Plus, Minus, Image as ImageIcon, Package } from "lucide-react";
import Breadcrumb from "../../components/Breadcrumb";
import { useToast, ToastContainer } from "../../components/Toast";

function fmtGBP(n) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(n || 0);
}

export default function CustomerProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast, toasts, removeToast } = useToast();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState([]);

  const cartRef = useRef([]);

  // Load cart from localStorage on mount
  useEffect(() => {
    // Initial load only
    const savedCart = localStorage.getItem("customerCart");
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        setCart(parsedCart);
        cartRef.current = parsedCart;
      } catch (e) {
        console.error("Failed to load cart:", e);
      }
    }
    
    // Listen for storage events and cartUpdated events
    const handleCartUpdate = () => {
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
          console.error("Failed to parse cart:", e);
        }
      }
    };
    
    window.addEventListener("storage", handleCartUpdate);
    window.addEventListener("cartUpdated", handleCartUpdate);
    
    return () => {
      window.removeEventListener("storage", handleCartUpdate);
      window.removeEventListener("cartUpdated", handleCartUpdate);
    };
  }, []); // Only run on mount

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    // Skip if cart hasn't actually changed
    const currentStr = JSON.stringify(cartRef.current);
    const newStr = JSON.stringify(cart);
    if (currentStr === newStr) {
      return;
    }
    
    cartRef.current = cart;
    localStorage.setItem("customerCart", JSON.stringify(cart));
    
    // Dispatch event after a delay
    setTimeout(() => {
      window.dispatchEvent(new Event("cartUpdated"));
    }, 100);
  }, [cart]);

  useEffect(() => {
    loadProduct();
  }, [id]);

  async function loadProduct() {
    setLoading(true);
    try {
      const data = await apiGet(`/api/products/${id}`);
      setProduct(data);
    } catch (e) {
      console.error("Failed to load product:", e);
      showToast("Product not found", "error");
      setTimeout(() => navigate("/customer/products"), 2000);
    } finally {
      setLoading(false);
    }
  }

  function getProductQuantity(productId) {
    const item = cart.find((item) => item.productId === productId);
    return item ? item.quantity : 0;
  }

  function addToCart() {
    if (!product || !product.isActive) {
      showToast("This product is not available", "error");
      return;
    }

    if (product.currentStock !== undefined && product.currentStock <= 0) {
      showToast("This product is out of stock", "error");
      return;
    }

    const qty = Math.max(1, parseInt(quantity) || 1);
    const existingIndex = cart.findIndex((item) => item.productId === product._id);
    
    const imageUrl = product.imageUrl?.startsWith("/uploads/products/")
      ? `/api/files/products/${product.imageUrl.split("/").pop()}`
      : product.imageUrl;
    
    if (existingIndex >= 0) {
      // Update quantity
      const newCart = [...cart];
      newCart[existingIndex].quantity += qty;
      newCart[existingIndex].subtotal = newCart[existingIndex].quantity * newCart[existingIndex].price;
      setCart(newCart);
      showToast(`${qty} x ${product.name} added to cart`, "success");
    } else {
      // Add new item
      setCart([
        ...cart,
        {
          productId: product._id,
          productName: product.name,
          name: product.name,
          price: product.price || 0,
          quantity: qty,
          subtotal: qty * (product.price || 0),
          imageUrl: imageUrl,
        },
      ]);
      showToast(`${qty} x ${product.name} added to cart`, "success");
    }
    setQuantity(1);
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center text-slate-400 py-12">Loading product...</div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  // Normalize image URL
  let imageSrc = null;
  if (product.imageUrl) {
    let normalizedUrl = product.imageUrl;
    if (product.imageUrl.startsWith("/uploads/products/")) {
      normalizedUrl = product.imageUrl.replace("/uploads/products/", "/api/files/products/");
    }
    imageSrc = normalizedUrl.startsWith("http")
      ? normalizedUrl
      : normalizedUrl.startsWith("/")
      ? `${API_URL}${normalizedUrl}`
      : `${API_URL}/${normalizedUrl}`;
  }

  const cartQuantity = getProductQuantity(product._id);

  return (
    <div className="max-w-6xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Products", onClick: () => navigate("/customer/products") },
          { label: product.name },
        ]}
      />

      <button
        onClick={() => navigate("/customer/products")}
        className="mb-6 inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Products
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product Image */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="relative w-full aspect-square bg-slate-800/50 flex items-center justify-center">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={product.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <ImageIcon className="w-32 h-32 text-slate-600" />
            )}
            {product.category && (
              <div className="absolute top-4 left-4 px-3 py-1.5 rounded-md bg-slate-900/90 backdrop-blur-sm text-xs font-semibold text-slate-200 uppercase tracking-wide">
                {product.category}
              </div>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 mb-2">{product.name}</h1>
            {product.brand && (
              <div className="text-sm text-slate-400 mb-4">Brand: {product.brand}</div>
            )}
            <div className="text-3xl font-bold text-emerald-400 mb-4">
              {fmtGBP(product.price || 0)}
            </div>
          </div>

          {product.description && (
            <div>
              <h2 className="text-lg font-semibold text-slate-200 mb-2">Description</h2>
              <p className="text-slate-300 leading-relaxed">{product.description}</p>
            </div>
          )}

          {/* Product Details */}
          <div className="space-y-3">
            {product.size && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-400">Size:</span>
                <span className="text-slate-200">{product.size}</span>
              </div>
            )}
            {product.currentStock !== undefined && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-400">Stock:</span>
                <span className={`font-medium ${product.currentStock > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {product.currentStock} {product.unit || "piece"}
                  {product.currentStock > 0 ? " available" : " out of stock"}
                </span>
              </div>
            )}
            {cartQuantity > 0 && (
              <div className="px-3 py-2 rounded-lg bg-sky-600/20 text-sky-300 text-sm">
                {cartQuantity} {cartQuantity === 1 ? "item" : "items"} in cart
              </div>
            )}
          </div>

          {/* Add to Cart Section */}
          <div className="pt-6 border-t border-slate-800">
            <div className="flex items-center gap-2">
              {/* Quantity Selector */}
              <div className="flex items-center gap-1 flex-1">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
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
                    setQuantity(Math.max(1, val));
                  }}
                  className="w-12 px-1 py-1.5 text-sm text-center rounded-lg border border-slate-700 bg-slate-900 text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500/50 disabled:opacity-50 disabled:cursor-not-allowed h-8"
                />
                <button
                  onClick={() => {
                    const max = product.currentStock !== undefined ? product.currentStock : 9999;
                    setQuantity(Math.min(max, quantity + 1));
                  }}
                  disabled={product.currentStock !== undefined && quantity >= product.currentStock}
                  className="w-8 h-8 p-0 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 flex items-center justify-center"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              
              {/* Add Button */}
              <button
                onClick={addToCart}
                disabled={!product.isActive || (product.currentStock !== undefined && product.currentStock <= 0)}
                className="h-8 px-3 py-0 rounded-lg bg-sky-600/80 hover:bg-sky-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 flex-shrink-0"
              >
                <ShoppingCart className="w-4 h-4" />
                Add
              </button>
            </div>

            <button
              onClick={() => navigate("/customer/cart")}
              className="w-full mt-3 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 transition-colors text-sm"
            >
              View Cart
            </button>
          </div>
        </div>
      </div>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
