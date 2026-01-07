import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { API_URL } from "../../lib/config";
import { apiPost, apiGet } from "../../lib/api";
import { ShoppingCart, Plus, Minus, X, Image as ImageIcon, ArrowLeft, Trash2, CreditCard } from "lucide-react";
import Breadcrumb from "../../components/Breadcrumb";
import { useToast, ToastContainer } from "../../components/Toast";
import { getUser } from "../../features/auth/auth";

function fmtGBP(n) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(n || 0);
}

export default function CustomerCart() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast, toasts, removeToast } = useToast();
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [customerBalance, setCustomerBalance] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("Not Set");
  const [paymentBreakdown, setPaymentBreakdown] = useState({
    balanceAmount: 0,
    cashAmount: 0,
    cardAmount: 0,
    bankAmount: 0,
  });
  const [showPaymentBreakdown, setShowPaymentBreakdown] = useState(false);

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
          console.log("[CustomerCart] Loading cart from localStorage:", parsedCart.length, "items");
          setCart(parsedCart);
          cartRef.current = parsedCart;
        }
      } catch (e) {
        console.error("Failed to load cart:", e);
      }
    } else {
      // If no cart in localStorage, only clear state if we had items before
      // Don't clear if cart was already empty (to prevent clearing on navigation)
      if (cartRef.current.length > 0) {
        console.log("[CustomerCart] Clearing cart (no localStorage data)");
        setCart([]);
        cartRef.current = [];
      }
    }
  }, []);

  // Load cart on mount and when location changes (user navigates to cart page)
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

  // Fetch customer balance on mount
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const user = getUser();
        if (user && user.role === "customer") {
          // Use /api/auth/me to get the latest user data including customerProfile.balance
          const response = await apiGet("/api/auth/me");
          setCustomerBalance(Number(response.user.customerProfile?.balance || 0));
        }
      } catch (e) {
        console.error("Failed to fetch customer balance:", e);
        setCustomerBalance(0); // Default to 0 if fetch fails
      }
    };
    fetchBalance();
  }, []);

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

  function updateQuantity(index, newQuantity) {
    if (newQuantity < 1) {
      removeItem(index);
      return;
    }
    const newCart = [...cart];
    newCart[index].quantity = newQuantity;
    newCart[index].subtotal = newQuantity * newCart[index].price;
    setCart(newCart);
  }

  function removeItem(index) {
    const item = cart[index];
    setCart(cart.filter((_, i) => i !== index));
    showToast(`${item.name} removed from cart`, "info");
  }

  // Update payment breakdown when payment method or total changes
  useEffect(() => {
    const total = cart.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    if (paymentMethod === "Balance" && customerBalance !== null && total > 0) {
      const balanceToUse = Math.min(total, customerBalance);
      setPaymentBreakdown({
        balanceAmount: balanceToUse,
        cashAmount: total - balanceToUse,
        cardAmount: 0,
        bankAmount: 0,
      });
      setShowPaymentBreakdown(true);
    } else if (paymentMethod === "Cash") {
      setPaymentBreakdown({ balanceAmount: 0, cashAmount: total, cardAmount: 0, bankAmount: 0 });
      setShowPaymentBreakdown(false);
    } else if (paymentMethod === "Card") {
      setPaymentBreakdown({ balanceAmount: 0, cashAmount: 0, cardAmount: total, bankAmount: 0 });
      setShowPaymentBreakdown(false);
    } else if (paymentMethod === "Bank Transfer") {
      setPaymentBreakdown({ balanceAmount: 0, cashAmount: 0, cardAmount: 0, bankAmount: total });
      setShowPaymentBreakdown(false);
    } else if (paymentMethod === "Split") {
      setShowPaymentBreakdown(true);
    } else {
      setShowPaymentBreakdown(false);
    }
  }, [paymentMethod, cart, customerBalance]);

  async function checkout() {
    if (cart.length === 0) {
      showToast("Your cart is empty", "error", 5000);
      return;
    }

    const total = cart.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const breakdownTotal = paymentBreakdown.balanceAmount + paymentBreakdown.cashAmount + 
                          paymentBreakdown.cardAmount + paymentBreakdown.bankAmount;
    
    // Validate payment breakdown
    if (showPaymentBreakdown && Math.abs(breakdownTotal - total) > 0.01) {
      showToast(`Payment breakdown (£${breakdownTotal.toFixed(2)}) does not match total (£${total.toFixed(2)})`, "error", 5000);
      return;
    }

    // Validate balance
    if (paymentBreakdown.balanceAmount > 0 && (customerBalance === null || customerBalance < paymentBreakdown.balanceAmount)) {
      showToast(`Insufficient balance. Available: £${customerBalance?.toFixed(2) || "0.00"}`, "error", 5000);
      return;
    }

    setLoading(true);
    try {
      console.log("[CustomerCart] Starting checkout process...");
      
      // Get customer user ID and profile from /api/auth/me
      const meData = await apiGet("/api/auth/me");
      const user = meData.user;
      
      if (!user || !user.customerProfile) {
        console.error("[CustomerCart] User or customerProfile not found:", { user });
        showToast("Customer profile not found. Please contact support.", "error", 5000);
        setLoading(false);
        return;
      }

      const customerId = user._id;

      console.log("[CustomerCart] Customer ID:", customerId);
      console.log("[CustomerCart] Order payload:", {
        shopName: user.customerProfile?.name || "Customer Order",
        customerName: user.customerProfile?.name || user.email,
        customer: customerId,
        totalAmount: total,
        paymentMethod: paymentMethod,
        paymentBreakdown: showPaymentBreakdown ? paymentBreakdown : {
          balanceAmount: paymentMethod === "Balance" ? total : 0,
          cashAmount: paymentMethod === "Cash" ? total : 0,
          cardAmount: paymentMethod === "Card" ? total : 0,
          bankAmount: paymentMethod === "Bank Transfer" ? total : 0,
        },
        items: cart.map((item) => ({
          productId: item.productId,
          productName: item.name,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal,
        })),
      });

      await apiPost("/api/orders", {
        shopName: user.customerProfile?.name || "Customer Order",
        customerName: user.customerProfile?.name || user.email,
        customer: customerId, // Add customer ID for balance deduction
        customerPhone: user.customerProfile?.phone || "",
        customerAddress: user.customerProfile?.address || "",
        customerPostcode: user.customerProfile?.postcode || "",
        customerCity: user.customerProfile?.city || "",
        totalAmount: total,
        paymentMethod: paymentMethod,
        paymentBreakdown: showPaymentBreakdown ? paymentBreakdown : {
          balanceAmount: paymentMethod === "Balance" ? total : 0,
          cashAmount: paymentMethod === "Cash" ? total : 0,
          cardAmount: paymentMethod === "Card" ? total : 0,
          bankAmount: paymentMethod === "Bank Transfer" ? total : 0,
        },
        status: "pending",
        items: cart.map((item) => ({
          productId: item.productId,
          productName: item.name,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal,
          imageUrl: item.imageUrl, // Include imageUrl for order items
        })),
      });

      console.log("[CustomerCart] Order placed successfully!");

      // Clear cart
      setCart([]);
      localStorage.removeItem("customerCart");
      showToast("Order placed successfully!", "success", 4000);
      
      // Redirect after a short delay
      setTimeout(() => {
        navigate("/customer/orders");
      }, 2000);
    } catch (e) {
      console.error("[CustomerCart] Checkout error:", e);
      showToast(e.message || "Failed to place order", "error", 5000);
    } finally {
      setLoading(false);
    }
  }

  const total = cart.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const itemCount = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);

  return (
    <div className="max-w-6xl mx-auto">
      <Breadcrumb items={[{ label: "Cart" }]} />

      <h1 className="text-2xl font-bold text-slate-100 mb-6">Shopping Cart</h1>

      {cart.length === 0 ? (
        <div className="text-center text-slate-400 py-16">
          <ShoppingCart className="w-20 h-20 mx-auto mb-4 text-slate-500" />
          <div className="text-lg mb-2">Your cart is empty</div>
          <button
            onClick={() => navigate("/customer/products")}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600/80 hover:bg-sky-600 text-white font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Continue Shopping
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cart.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 rounded-lg border border-slate-800 bg-slate-900/60"
              >
                {/* Product Image */}
                <div 
                  className="w-20 h-20 rounded-lg border border-slate-700 bg-slate-800/50 flex-shrink-0 flex items-center justify-center overflow-hidden cursor-pointer"
                  onClick={() => navigate(`/customer/products/${item.productId}`)}
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl.startsWith("http") ? item.imageUrl : `${API_URL}${item.imageUrl}`}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-slate-600" />
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <h3 
                    className="font-medium text-slate-100 mb-1 cursor-pointer hover:text-sky-400 transition-colors"
                    onClick={() => navigate(`/customer/products/${item.productId}`)}
                  >
                    {item.name}
                  </h3>
                  <div className="text-sm text-slate-400">£{Number(item.price || 0).toFixed(2)} each</div>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(index, Math.max(1, (item.quantity || 1) - 1))}
                    className="p-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center text-slate-100 font-medium">{item.quantity || 1}</span>
                  <button
                    onClick={() => updateQuantity(index, (item.quantity || 1) + 1)}
                    className="p-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Subtotal */}
                <div className="text-right min-w-[100px]">
                  <div className="font-semibold text-slate-100">{fmtGBP(item.subtotal || 0)}</div>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => removeItem(index)}
                  className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors"
                  title="Remove from cart"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 sticky top-4">
              <h2 className="text-lg font-semibold text-slate-100 mb-4">Order Summary</h2>
              
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm text-slate-400">
                  <span>Items ({itemCount})</span>
                  <span>{fmtGBP(total)}</span>
                </div>
              </div>

              {/* Customer Balance Display - Always show */}
              <div className="mb-4 px-4 py-2 rounded-lg bg-sky-600/20 border border-sky-600/30">
                <div className="text-sm text-slate-300">
                  <span className="text-slate-400">Your Balance: </span>
                  <span className="font-semibold text-sky-300">
                    {customerBalance !== null ? `£${customerBalance.toFixed(2)}` : "Loading..."}
                  </span>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50"
                >
                  <option value="Not Set">Select Payment Method</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  {customerBalance !== null && customerBalance > 0 && (
                    <>
                      <option value="Balance">Use Balance (£{customerBalance.toFixed(2)})</option>
                      <option value="Split">Split Payment</option>
                    </>
                  )}
                </select>
              </div>

              {/* Payment Breakdown */}
              {showPaymentBreakdown && (
                <div className="mb-4 space-y-3 p-4 rounded-lg border border-slate-700 bg-slate-800/30">
                  <h3 className="text-sm font-semibold text-slate-300">Payment Breakdown</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {customerBalance !== null && customerBalance > 0 && (
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Balance</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={customerBalance}
                          value={paymentBreakdown.balanceAmount}
                        onChange={(e) => {
                          // Remove leading zeros
                          const cleanValue = e.target.value.replace(/^0+/, "") || "0";
                          const val = cleanValue === "" ? 0 : Number(cleanValue);
                          const numVal = isNaN(val) ? 0 : val;
                          const remaining = total - numVal;
                          setPaymentBreakdown({
                            balanceAmount: numVal,
                            cashAmount: Math.max(0, remaining),
                            cardAmount: 0,
                            bankAmount: 0,
                          });
                        }}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Cash</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={paymentBreakdown.cashAmount}
                        onChange={(e) => {
                          // Remove leading zeros
                          const cleanValue = e.target.value.replace(/^0+/, "") || "0";
                          const val = cleanValue === "" ? 0 : Number(cleanValue);
                          const numVal = isNaN(val) ? 0 : val;
                          const remaining = total - paymentBreakdown.balanceAmount - numVal;
                          setPaymentBreakdown({
                            ...paymentBreakdown,
                            cashAmount: numVal,
                            cardAmount: Math.max(0, remaining),
                            bankAmount: 0,
                          });
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Card</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={paymentBreakdown.cardAmount}
                        onChange={(e) => {
                          // Remove leading zeros
                          const cleanValue = e.target.value.replace(/^0+/, "") || "0";
                          const val = cleanValue === "" ? 0 : Number(cleanValue);
                          const numVal = isNaN(val) ? 0 : val;
                          const remaining = total - paymentBreakdown.balanceAmount - paymentBreakdown.cashAmount - numVal;
                          setPaymentBreakdown({
                            ...paymentBreakdown,
                            cardAmount: numVal,
                            bankAmount: Math.max(0, remaining),
                          });
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Bank Transfer</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={paymentBreakdown.bankAmount}
                        onChange={(e) => {
                          // Remove leading zeros
                          const cleanValue = e.target.value.replace(/^0+/, "") || "0";
                          const val = cleanValue === "" ? 0 : Number(cleanValue);
                          const numVal = isNaN(val) ? 0 : val;
                          setPaymentBreakdown({
                            ...paymentBreakdown,
                            bankAmount: numVal,
                          });
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                      />
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-700">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Breakdown Total:</span>
                      <span className={`font-semibold ${
                        Math.abs((paymentBreakdown.balanceAmount + paymentBreakdown.cashAmount + paymentBreakdown.cardAmount + paymentBreakdown.bankAmount) - total) > 0.01 ? "text-red-400" : "text-emerald-400"
                      }`}>
                        £{(paymentBreakdown.balanceAmount + paymentBreakdown.cashAmount + paymentBreakdown.cardAmount + paymentBreakdown.bankAmount).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm mt-1">
                      <span className="text-slate-400">Order Total:</span>
                      <span className="font-semibold text-slate-200">£{total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-800 pt-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-slate-200">Total</span>
                  <span className="text-2xl font-bold text-emerald-400">{fmtGBP(total)}</span>
                </div>
              </div>

              <button
                onClick={checkout}
                disabled={loading || cart.length === 0 || paymentMethod === "Not Set"}
                className="w-full py-3 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5" />
                    Place Order
                  </>
                )}
              </button>

              <button
                onClick={() => navigate("/customer/products")}
                className="w-full mt-3 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 transition-colors text-sm"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
