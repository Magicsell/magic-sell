import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import Breadcrumb from "../../components/Breadcrumb";
import { apiGet, apiPost, apiPatch } from "../../lib/api";
import { Plus, X, Trash2, ShoppingCart, FileText, User, MapPin, Calendar, CreditCard } from "lucide-react";
import ProductSelectionModal from "../../components/ProductSelectionModal";
import { API_URL } from "../../lib/config";

/* ==== UK validators & formatters ==== */
const UK_POSTCODE_RE =
  /^(GIR 0AA|((([A-PR-UWYZ][0-9][0-9]?)|([A-PR-UWYZ][A-HK-Y][0-9][0-9]?)|([A-PR-UWYZ][0-9][A-HJKSTUW])|([A-PR-UWYZ][A-HK-Y][0-9][ABEHMNPRV-Y]))\s?[0-9][ABD-HJLNP-UW-Z]{2}))$/i;

function formatUKPostcode(v) {
  if (!v) return "";
  const s = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length < 5) return v.toUpperCase();
  return `${s.slice(0, -3)} ${s.slice(-3)}`;
}
function isValidUKPostcode(v) {
  if (!v) return true;
  return UK_POSTCODE_RE.test(v.trim().toUpperCase());
}
function normalizeUKPhone(v) {
  if (!v) return "";
  const s = v.replace(/[^\d+]/g, "");
  if (/^0\d{10}$/.test(s)) return "+44" + s.slice(1);
  if (/^\+?44\d{9,10}$/.test(s)) return s.startsWith("+") ? s : "+" + s;
  return null;
}
function isValidUKPhone(v) {
  if (!v) return true;
  return normalizeUKPhone(v) !== null;
}
function emptyToNull(v) {
  const t = (v || "").trim();
  return t ? t : null;
}
function nowLocalValue() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
function toLocalValue(dt) {
  const d = dt ? new Date(dt) : new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/* ---------- UI helpers ---------- */
const INPUT_CLS = `
  w-full rounded-lg border px-3 py-2
  bg-slate-800/50 text-slate-100 text-sm border-slate-700 placeholder:text-slate-500
  focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50
  transition-all
`;
const SELECT_CLS = `
  w-full rounded-lg border px-3 py-2 pr-8
  bg-slate-800/50 text-slate-100 text-sm border-slate-700
  focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50
  transition-all cursor-pointer appearance-none
  bg-[url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")] bg-[length:16px_16px] bg-[right_0.5rem_center] bg-no-repeat
`;

function Field({ label, error, children, required, icon: Icon }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </span>
      {children}
      <div className="h-4 mt-0.5 min-h-[1rem]">
        {error && (
          <span className="text-xs text-red-400">{error}</span>
        )}
      </div>
    </label>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
        {Icon && <Icon className="w-4 h-4 text-slate-400" />}
        <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

export default function OrderForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("id");
  const expectedOrderNo = searchParams.get("expectedOrderNo");

  const isEdit = !!orderId;
  const isNew = location.pathname.includes("/new");

  const [form, setForm] = useState({
    shopName: "",
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    customerPostcode: "",
    totalAmount: "",
    paymentMethod: "Not Set",
    paymentBreakdown: {
      balanceAmount: 0,
      cashAmount: 0,
      cardAmount: 0,
      bankAmount: 0,
    },
    orderDate: nowLocalValue(),
    items: [], // Order items (opsiyonel)
    orderNo: null, // Order number (for edit mode)
  });
  
  const [customerBalance, setCustomerBalance] = useState(null); // Customer balance for display

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showList, setShowList] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);

  // Customers autocomplete - Use new User model customers only
  const [customerUsers, setCustomerUsers] = useState([]); // User model customers
  useEffect(() => {
    (async () => {
      try {
        // Fetch customer users (new User model)
        const usersData = await apiGet("/api/users?role=customer&isApproved=true");
        setCustomerUsers(usersData.users || []);
      } catch {}
    })();
  }, []);

  // Load order data for edit
  useEffect(() => {
    if (isEdit && orderId) {
      setLoading(true);
      (async () => {
        try {
          const order = await apiGet(`/api/orders/${orderId}`);
          // Ensure items have all required fields
          const items = (order.items || []).map((item) => ({
            productId: item.productId || null,
            productName: item.productName || "",
            quantity: Number(item.quantity) || 1,
            price: Number(item.price) || 0,
            subtotal: Number(item.subtotal || item.quantity * item.price) || 0,
            imageUrl: item.imageUrl || null, // Include imageUrl from backend
          }));
          
          // Ensure paymentBreakdown has all required fields with proper defaults
          // Check if paymentBreakdown exists and has the structure we expect
          let paymentBreakdown = {
            balanceAmount: 0,
            cashAmount: 0,
            cardAmount: 0,
            bankAmount: 0,
          };
          
          if (order.paymentBreakdown && typeof order.paymentBreakdown === 'object') {
            paymentBreakdown = {
              balanceAmount: Number(order.paymentBreakdown.balanceAmount || 0),
              cashAmount: Number(order.paymentBreakdown.cashAmount || 0),
              cardAmount: Number(order.paymentBreakdown.cardAmount || 0),
              bankAmount: Number(order.paymentBreakdown.bankAmount || 0),
            };
          }
          
          console.log("[OrderForm] Loading order - paymentBreakdown from backend:", order.paymentBreakdown);
          console.log("[OrderForm] Parsed paymentBreakdown:", paymentBreakdown);
          
          setForm({
            shopName: order.shopName || "",
            customerName: order.customerName || "",
            customerPhone: order.customerPhone || "",
            customerAddress: order.customerAddress || "",
            customerPostcode: order.customerPostcode || "",
            totalAmount: order.totalAmount != null ? String(order.totalAmount) : "",
            paymentMethod: order.paymentMethod || "Not Set",
            paymentBreakdown: paymentBreakdown,
            orderDate: toLocalValue(order.orderDate),
            items: items,
            orderNo: order.orderNo || null, // Include orderNo for edit mode
          });
          
          // Load customer balance if customerName exists
          if (order.customerName) {
            // Find customer user and get balance
            const customerUser = customerUsers.find(
              (u) => u.customerProfile?.name === order.customerName
            );
            if (customerUser?.customerProfile?.balance !== undefined) {
              setCustomerBalance(Number(customerUser.customerProfile.balance));
            } else {
              setCustomerBalance(null);
            }
          }
          
          // Recalculate total from items if they exist
          if (items.length > 0) {
            const itemsTotal = items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
            if (itemsTotal > 0) {
              setForm((prev) => ({ ...prev, totalAmount: String(itemsTotal.toFixed(2)) }));
            }
          }
        } catch (e) {
          setErr(e.message || "Failed to load order");
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [isEdit, orderId]);

  const filteredShops = useMemo(() => {
    const q = (form.shopName || "").toLowerCase();
    if (!q) {
      // Return first 8 customers, using customerProfile.name as shopName
      return customerUsers
        .filter((u) => u.customerProfile?.name)
        .slice(0, 8)
        .map((u) => ({
          _id: u._id,
          shopName: u.customerProfile.name,
          name: u.customerProfile.name,
          phone: u.customerProfile.phone,
          address: u.customerProfile.address,
          postcode: u.customerProfile.postcode,
          city: u.customerProfile.city,
        }));
    }
    return customerUsers
      .filter((u) => {
        const name = (u.customerProfile?.name || "").toLowerCase();
        const shopName = name; // Use name as shopName for new customers
        return shopName.includes(q) || name.includes(q);
      })
      .slice(0, 8)
      .map((u) => ({
        _id: u._id,
        shopName: u.customerProfile.name,
        name: u.customerProfile.name,
        phone: u.customerProfile.phone,
        address: u.customerProfile.address,
        postcode: u.customerProfile.postcode,
        city: u.customerProfile.city,
      }));
  }, [customerUsers, form.shopName]);

  function pickCustomer(c) {
    setForm((s) => ({
      ...s,
      shopName: c.shopName || c.name || "",
      customerName: c.name || s.customerName,
      customerPhone: c.phone || s.customerPhone,
      customerAddress: c.address || s.customerAddress,
      customerPostcode: c.postcode || s.customerPostcode,
    }));
    setShowList(false);
    
    // Find customer user and get balance (c is already from customerUsers)
    const customerUser = customerUsers.find((u) => u._id === c._id);
    if (customerUser?.customerProfile?.balance !== undefined) {
      setCustomerBalance(Number(customerUser.customerProfile.balance));
    } else {
      setCustomerBalance(null);
    }
  }
  
  // Load customer balance when customerName changes manually
  useEffect(() => {
    if (form.customerName) {
      const customerUser = customerUsers.find(
        (u) => u.customerProfile?.name === form.customerName
      );
      if (customerUser?.customerProfile?.balance !== undefined) {
        setCustomerBalance(Number(customerUser.customerProfile.balance));
      } else {
        setCustomerBalance(null);
      }
    } else {
      setCustomerBalance(null);
    }
  }, [form.customerName, customerUsers]);

  // Close dropdown when clicking outside
  const shopNameRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(event) {
      if (shopNameRef.current && !shopNameRef.current.contains(event.target)) {
        setShowList(false);
      }
    }

    if (showList) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showList]);

  function onChange(e) {
    const { name, value } = e.target;
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    
    // Handle payment breakdown changes
    if (name.startsWith("paymentBreakdown.")) {
      const field = name.split(".")[1];
      // Handle empty value
      if (value === "" || value === null || value === undefined) {
        setForm((s) => ({
          ...s,
          paymentBreakdown: {
            ...s.paymentBreakdown,
            [field]: 0,
          },
        }));
        return;
      }
      
      // Convert to string and trim
      let cleanValue = value.toString().trim();
      
      // Remove leading zeros (but keep single 0 and decimals like 0.5)
      // Match pattern: starts with one or more zeros, followed by a digit (not a decimal point)
      if (cleanValue.length > 1 && /^0+[1-9]/.test(cleanValue)) {
        // Remove all leading zeros
        cleanValue = cleanValue.replace(/^0+/, "");
        // If empty after removing zeros, keep 0
        if (cleanValue === "" || cleanValue === ".") cleanValue = "0";
      }
      
      // Parse as float
      const numValue = cleanValue === "" ? 0 : parseFloat(cleanValue);
      
      // Update form state
      setForm((s) => ({
        ...s,
        paymentBreakdown: {
          ...s.paymentBreakdown,
          [field]: isNaN(numValue) ? 0 : numValue,
        },
      }));
      return;
    }
    
    setForm((s) => ({
      ...s,
      [name]: name === "customerPostcode" ? formatUKPostcode(value) : value,
    }));
    
    // If payment method changes, auto-set breakdown
    if (name === "paymentMethod") {
      const total = Number(form.totalAmount) || 0;
      if (value === "Balance" && customerBalance !== null) {
        const balanceToUse = Math.min(total, customerBalance);
        setForm((s) => ({
          ...s,
          paymentBreakdown: {
            balanceAmount: balanceToUse,
            cashAmount: total - balanceToUse,
            cardAmount: 0,
            bankAmount: 0,
          },
        }));
      } else if (value === "Cash") {
        setForm((s) => ({
          ...s,
          paymentBreakdown: {
            balanceAmount: 0,
            cashAmount: total,
            cardAmount: 0,
            bankAmount: 0,
          },
        }));
      } else if (value === "Card") {
        setForm((s) => ({
          ...s,
          paymentBreakdown: {
            balanceAmount: 0,
            cashAmount: 0,
            cardAmount: total,
            bankAmount: 0,
          },
        }));
      } else if (value === "Bank Transfer") {
        setForm((s) => ({
          ...s,
          paymentBreakdown: {
            balanceAmount: 0,
            cashAmount: 0,
            cardAmount: 0,
            bankAmount: total,
          },
        }));
      } else if (value === "Split") {
        // Initialize split breakdown with total in cash (user can adjust)
        setForm((s) => ({
          ...s,
          paymentBreakdown: {
            balanceAmount: 0,
            cashAmount: total,
            cardAmount: 0,
            bankAmount: 0,
          },
        }));
      } else {
        // For "Not Set" or other methods, reset breakdown
        setForm((s) => ({
          ...s,
          paymentBreakdown: {
            balanceAmount: 0,
            cashAmount: 0,
            cardAmount: 0,
            bankAmount: 0,
          },
        }));
      }
    }
  }

  // Add product from modal
  function handleAddProductFromModal(productItem) {
    setForm((prev) => {
      // Check if product already exists, if so update quantity
      const existingIndex = prev.items.findIndex(
        (item) => item.productId === productItem.productId
      );
      
      if (existingIndex >= 0) {
        const newItems = [...prev.items];
        const existing = newItems[existingIndex];
        newItems[existingIndex] = {
          ...existing,
          quantity: existing.quantity + productItem.quantity,
          subtotal: (existing.quantity + productItem.quantity) * existing.price,
          imageUrl: productItem.imageUrl || existing.imageUrl, // Preserve or update image
        };
        return { ...prev, items: newItems };
      }
      
      return { ...prev, items: [...prev.items, productItem] };
    });
    calculateTotal();
  }

  // Remove product item
  function removeProductItem(index) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
    calculateTotal();
  }

  // Update product item quantity or price
  function updateProductItem(index, field, value) {
    setForm((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      
      // Calculate subtotal
      if (field === "quantity" || field === "price") {
        newItems[index].subtotal = (newItems[index].quantity || 0) * (newItems[index].price || 0);
      }
      
      return { ...prev, items: newItems };
    });
    calculateTotal();
  }

  // Calculate total from items or manual amount
  function calculateTotal() {
    setForm((prev) => {
      const itemsTotal = prev.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
      // If items exist, use items total, otherwise keep manual amount
      if (prev.items.length > 0 && itemsTotal > 0) {
        const newTotal = itemsTotal;
        // Auto-adjust payment breakdown if payment method is set
        let newBreakdown = prev.paymentBreakdown;
        if (prev.paymentMethod === "Balance" && customerBalance !== null) {
          const balanceToUse = Math.min(newTotal, customerBalance);
          newBreakdown = {
            balanceAmount: balanceToUse,
            cashAmount: newTotal - balanceToUse,
            cardAmount: 0,
            bankAmount: 0,
          };
        } else if (prev.paymentMethod === "Cash") {
          newBreakdown = { balanceAmount: 0, cashAmount: newTotal, cardAmount: 0, bankAmount: 0 };
        } else if (prev.paymentMethod === "Card") {
          newBreakdown = { balanceAmount: 0, cashAmount: 0, cardAmount: newTotal, bankAmount: 0 };
        } else if (prev.paymentMethod === "Bank Transfer") {
          newBreakdown = { balanceAmount: 0, cashAmount: 0, cardAmount: 0, bankAmount: newTotal };
        }
        return { ...prev, totalAmount: String(newTotal.toFixed(2)), paymentBreakdown: newBreakdown };
      }
      return prev;
    });
  }
  
  // Update breakdown when totalAmount changes manually
  useEffect(() => {
    const total = Number(form.totalAmount) || 0;
    if (form.paymentMethod === "Balance" && customerBalance !== null && total > 0) {
      const balanceToUse = Math.min(total, customerBalance);
      setForm((prev) => ({
        ...prev,
        paymentBreakdown: {
          balanceAmount: balanceToUse,
          cashAmount: total - balanceToUse,
          cardAmount: 0,
          bankAmount: 0,
        },
      }));
    }
  }, [form.totalAmount, form.paymentMethod, customerBalance]);

  // Validation
  const v = useMemo(() => {
    const errors = {};
    if (!form.shopName.trim()) errors.shopName = "Shop name is required.";
    const amountOk =
      form.totalAmount !== "" &&
      !isNaN(Number(form.totalAmount)) &&
      Number(form.totalAmount) >= 0;
    if (!amountOk) errors.totalAmount = "Enter a valid amount (e.g. 12.50).";
    if (form.customerPhone && !isValidUKPhone(form.customerPhone))
      errors.customerPhone = "Enter a valid UK phone (07… or +44…).";
    if (form.customerPostcode && !isValidUKPostcode(form.customerPostcode))
      errors.customerPostcode = "Enter a valid UK postcode (e.g. SW1A 1AA).";
    if (!form.orderDate) errors.orderDate = "Order date is required.";
    setFieldErrors(errors);
    return { ok: Object.keys(errors).length === 0, errors };
  }, [form]);

  // Submit
  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!v.ok) return;

    // Find customer user ID if customerName matches
    let customerId = null;
    if (form.customerName) {
      const customerUser = customerUsers.find(
        (u) => u.customerProfile?.name === form.customerName
      );
      if (customerUser) {
        customerId = customerUser._id;
      }
    }
    
    const payload = {
      shopName: form.shopName.trim(),
      customerName: emptyToNull(form.customerName),
      customer: customerId, // Add customer ID for balance deduction
      customerPhone: form.customerPhone ? normalizeUKPhone(form.customerPhone) : null,
      customerAddress: emptyToNull(form.customerAddress),
      customerPostcode: form.customerPostcode ? formatUKPostcode(form.customerPostcode) : null,
      totalAmount: Number(form.totalAmount),
      paymentMethod: form.paymentMethod,
      paymentBreakdown: form.paymentBreakdown || {
        balanceAmount: 0,
        cashAmount: 0,
        cardAmount: 0,
        bankAmount: 0,
      },
      orderDate: form.orderDate
        ? new Date(form.orderDate).toISOString()
        : new Date().toISOString(),
      // Items (opsiyonel - sadece product seçilmişse gönder)
      items: form.items
        .filter((item) => item.productId && item.quantity > 0)
        .map((item) => ({
          productId: item.productId,
          productName: item.productName || "",
          quantity: Number(item.quantity),
          price: Number(item.price),
          subtotal: Number(item.subtotal || item.quantity * item.price),
        })),
      // Expected order number for counter initialization
      expectedOrderNo: isNew && expectedOrderNo ? Number(expectedOrderNo) : undefined,
    };
    
    console.log("[OrderForm] Submitting payload with paymentBreakdown:", payload.paymentBreakdown);

    try {
      setBusy(true);
      if (isEdit) {
        await apiPatch(`/api/orders/${orderId}`, payload);
      } else {
        await apiPost("/api/orders", payload);
      }
      navigate("/admin/orders");
    } catch (e) {
      setErr(e.message || (isEdit ? "Failed to save order." : "Failed to create order."));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div>
        <div className="text-center text-slate-400">Loading order...</div>
      </div>
    );
  }

  const itemsTotal = form.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);

  return (
    <div className="max-w-6xl mx-auto">
        <Breadcrumb
          items={[
            { label: "Orders", path: "/admin/orders" },
            { label: isEdit ? "Edit Order" : "New Order", path: location.pathname },
          ]}
        />
        <h1 className="text-2xl font-bold text-slate-100 mb-6">
          {isEdit ? "Edit Order" : "Add New Order"}
        </h1>

        <form id="order-form" onSubmit={onSubmit} className="space-y-6">
          {/* Error message */}
          {err && (
            <div className="rounded-lg px-4 py-3 text-sm border bg-red-500/15 text-red-300 border-red-500/30">
              {err}
            </div>
          )}

          {/* Order Information */}
          <Section title="Order Information" icon={FileText}>
            {/* Order Number */}
            {(isNew && expectedOrderNo) || (isEdit && form.orderNo) ? (
              <div className="flex items-center gap-2 text-sm pb-2 border-b border-slate-800">
                <span className="text-xs text-slate-400">Order Number:</span>
                <span className="font-mono font-semibold text-emerald-400">
                  #{String(isEdit ? form.orderNo : expectedOrderNo).padStart(4, "0")}
                </span>
                {isNew && <span className="text-xs text-slate-500">(Auto-assigned)</span>}
              </div>
            ) : null}

            {/* Shop + Autocomplete */}
            <Field label="Shop name" error={fieldErrors.shopName} required icon={User}>
            <div className="relative" ref={shopNameRef}>
              <input
                name="shopName"
                value={form.shopName}
                onChange={onChange}
                onFocus={() => {
                  if (filteredShops.length > 0) {
                    setShowList(true);
                  }
                }}
                className={INPUT_CLS}
                autoComplete="off"
              />
              {showList && filteredShops.length > 0 && (
                <div
                  className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border bg-slate-800 text-slate-100 border-slate-700 shadow-xl"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {filteredShops.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => pickCustomer(c)}
                      className="block w-full text-left px-3 py-2 hover:bg-slate-700"
                    >
                      <div className="font-medium">{c.shopName || c.name}</div>
                      <div className="text-xs text-slate-400">
                        {c.phone || c.postcode || c.address || ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Customer name" icon={User}>
                <input
                  name="customerName"
                  value={form.customerName}
                  onChange={onChange}
                  className={INPUT_CLS}
                  placeholder="Customer name"
                />
              </Field>
              <Field label="Customer phone" error={fieldErrors.customerPhone} icon={User}>
                <input
                  name="customerPhone"
                  value={form.customerPhone}
                  onChange={onChange}
                  placeholder="+44… or 07…"
                  className={INPUT_CLS}
                />
              </Field>
            </div>

            <Field label="Address" icon={MapPin}>
              <input
                name="customerAddress"
                value={form.customerAddress}
                onChange={onChange}
                className={INPUT_CLS}
                placeholder="Customer address"
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Postcode" error={fieldErrors.customerPostcode} icon={MapPin}>
                <input
                  name="customerPostcode"
                  value={form.customerPostcode}
                  onChange={onChange}
                  placeholder="SW1A 1AA"
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Order date" error={fieldErrors.orderDate} required icon={Calendar}>
                <input
                  type="datetime-local"
                  name="orderDate"
                  value={form.orderDate}
                  onChange={onChange}
                  className={INPUT_CLS}
                />
              </Field>
            </div>
          </Section>

          {/* Order Items (Optional) */}
          <Section title="Order Items (Optional)" icon={ShoppingCart}>
            <div className="flex justify-end mb-4">
              <button
                type="button"
                onClick={() => setShowProductModal(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                Add Products
              </button>
            </div>

            {form.items.length === 0 ? (
              <div className="text-center py-8 rounded-lg border-2 border-dashed border-slate-700 bg-slate-800/20">
                <ShoppingCart className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400">
                  No items added. Click "Add Products" to select products or enter total amount manually below.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {form.items.map((item, index) => {
                  // Normalize image URL
                  let imageSrc = null;
                  if (item.imageUrl) {
                    if (item.imageUrl.startsWith("/uploads/products/")) {
                      imageSrc = `${API_URL}/api/files/products/${item.imageUrl.split("/").pop()}`;
                    } else if (item.imageUrl.startsWith("http") || item.imageUrl.startsWith("data:")) {
                      imageSrc = item.imageUrl;
                    } else if (item.imageUrl.startsWith("/")) {
                      imageSrc = `${API_URL}${item.imageUrl}`;
                    } else {
                      imageSrc = `${API_URL}/${item.imageUrl}`;
                    }
                  }
                  
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-4 rounded-lg border border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                    >
                      {/* Product Image */}
                      <div className="w-16 h-16 rounded-lg border border-slate-700 bg-slate-800/50 flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {imageSrc ? (
                          <img
                            src={imageSrc}
                            alt={item.productName || "Product"}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = "none";
                              e.target.nextSibling.style.display = "flex";
                            }}
                          />
                        ) : null}
                        <div className="w-full h-full flex items-center justify-center" style={{ display: imageSrc ? "none" : "flex" }}>
                          <ShoppingCart className="w-6 h-6 text-slate-600" />
                        </div>
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-100 truncate">
                          {item.productName || "Unknown Product"}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          £{Number(item.price || 0).toFixed(2)} each
                        </p>
                      </div>

                      {/* Quantity */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateProductItem(index, "quantity", Math.max(1, (item.quantity || 1) - 1))}
                          className="p-1.5 rounded border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          max="9999"
                          value={item.quantity || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Remove leading zeros
                            const cleanVal = val === "" ? "" : val.replace(/^0+/, "") || "0";
                            const numVal = cleanVal === "" ? 1 : Number(cleanVal) || 1;
                            updateProductItem(index, "quantity", Math.max(1, numVal));
                          }}
                          onBlur={(e) => {
                            // Ensure minimum value of 1
                            if (!e.target.value || Number(e.target.value) < 1) {
                              updateProductItem(index, "quantity", 1);
                            }
                          }}
                          className="w-16 px-2 py-1.5 text-center text-sm rounded border border-slate-700 bg-slate-900 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => updateProductItem(index, "quantity", (item.quantity || 1) + 1)}
                          className="p-1.5 rounded border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Price (Display only) */}
                      <div className="w-24 text-right">
                        <div className="text-sm font-medium text-slate-300">
                          £{Number(item.price || 0).toFixed(2)}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">per unit</div>
                      </div>

                      {/* Subtotal */}
                      <div className="w-24 text-right">
                        <span className="text-sm font-semibold text-slate-100">
                          £{(item.subtotal || 0).toFixed(2)}
                        </span>
                      </div>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => removeProductItem(index)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
                {itemsTotal > 0 && (
                  <div className="pt-3 border-t border-slate-700 flex justify-end">
                    <div className="text-base">
                      <span className="text-slate-400">Items Total: </span>
                      <span className="font-bold text-emerald-400">£{itemsTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Product Selection Modal */}
          <ProductSelectionModal
            open={showProductModal}
            onClose={() => setShowProductModal(false)}
            onAddProduct={handleAddProductFromModal}
            existingProductIds={form.items.map((item) => item.productId).filter(Boolean)}
          />

          {/* Payment & Total */}
          <Section title="Payment & Total" icon={CreditCard}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <div className="space-y-1.5">
                <Field label="Total amount" error={fieldErrors.totalAmount} required icon={CreditCard}>
                  <input
                    name="totalAmount"
                    inputMode="decimal"
                    value={form.totalAmount}
                    onChange={onChange}
                    className={INPUT_CLS}
                    placeholder="0.00"
                  />
                </Field>
                <div className="h-4">
                  {itemsTotal > 0 && (
                    <p className="text-xs text-slate-500">
                      Items total: £{itemsTotal.toFixed(2)}. You can override manually.
                    </p>
                  )}
                </div>
              </div>
              <Field label="Payment method" icon={CreditCard}>
                <select
                  name="paymentMethod"
                  value={form.paymentMethod}
                  onChange={onChange}
                  className={SELECT_CLS}
                >
                  <option>Not Set</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Balance">Balance</option>
                  <option value="Split">Split Payment</option>
                </select>
              </Field>
            </div>
            
            {/* Customer Balance Display */}
            {customerBalance !== null && (
              <div className="px-4 py-2 rounded-lg bg-sky-600/20 border border-sky-600/30">
                <div className="text-sm text-slate-300">
                  <span className="text-slate-400">Customer Balance: </span>
                  <span className="font-semibold text-sky-300">£{customerBalance.toFixed(2)}</span>
                </div>
              </div>
            )}
            
            {/* Payment Breakdown (shown only when Split is selected) */}
            {form.paymentMethod === "Split" && (
              <div className="mt-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-300">Payment Breakdown</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Balance" icon={CreditCard}>
                    <input
                      name="paymentBreakdown.balanceAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      max={customerBalance !== null ? customerBalance : undefined}
                      value={form.paymentBreakdown.balanceAmount || ""}
                      onChange={onChange}
                      className={INPUT_CLS}
                      placeholder="0.00"
                    />
                    {customerBalance !== null && (
                      <p className="text-xs text-slate-500 mt-1">
                        Available: £{customerBalance.toFixed(2)}
                      </p>
                    )}
                  </Field>
                  <Field label="Cash" icon={CreditCard}>
                    <input
                      name="paymentBreakdown.cashAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.paymentBreakdown.cashAmount || ""}
                      onChange={onChange}
                      className={INPUT_CLS}
                      placeholder="0.00"
                    />
                  </Field>
                  <Field label="Card" icon={CreditCard}>
                    <input
                      name="paymentBreakdown.cardAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.paymentBreakdown.cardAmount || ""}
                      onChange={onChange}
                      className={INPUT_CLS}
                      placeholder="0.00"
                    />
                  </Field>
                  <Field label="Bank Transfer" icon={CreditCard}>
                    <input
                      name="paymentBreakdown.bankAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.paymentBreakdown.bankAmount || ""}
                      onChange={onChange}
                      className={INPUT_CLS}
                      placeholder="0.00"
                    />
                  </Field>
                </div>
                <div className="pt-2 border-t border-slate-700">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Breakdown Total:</span>
                    <span className={`text-sm font-semibold ${
                      Math.abs(
                        (form.paymentBreakdown.balanceAmount + 
                         form.paymentBreakdown.cashAmount + 
                         form.paymentBreakdown.cardAmount + 
                         form.paymentBreakdown.bankAmount) - 
                        Number(form.totalAmount || 0)
                      ) > 0.01
                        ? "text-red-400"
                        : "text-emerald-400"
                    }`}>
                      £{(
                        form.paymentBreakdown.balanceAmount + 
                        form.paymentBreakdown.cashAmount + 
                        form.paymentBreakdown.cardAmount + 
                        form.paymentBreakdown.bankAmount
                      ).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-sm text-slate-400">Order Total:</span>
                    <span className="text-sm font-semibold text-slate-200">
                      £{Number(form.totalAmount || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </Section>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <button
              type="submit"
              disabled={busy || !v.ok}
              className="px-6 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {busy ? "Saving…" : isEdit ? "Save Order" : "Save Order"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin/orders")}
              className="px-6 py-3 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition-colors ml-auto"
            >
              Discard
            </button>
          </div>
        </form>
    </div>
  );
}
