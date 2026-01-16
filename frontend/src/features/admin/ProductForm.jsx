import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { apiGet, apiPost, apiPatch } from "../../lib/api";
import { API_URL } from "../../lib/config";
import { getToken } from "../../features/auth/auth";
import { Upload, X, Image as ImageIcon, FileText, Tag, Grid, Camera, ToggleLeft } from "lucide-react";
import Breadcrumb from "../../components/Breadcrumb";
import { useToast } from "../../components/Toast";
import { useApiError } from "../../hooks/useApiError";
import { ToastContainer } from "../../components/Toast";

const INPUT_CLS = `
  w-full rounded-lg border px-3 py-2
  bg-slate-800/50 text-slate-100 text-sm border-slate-700 placeholder:text-slate-500
  focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50
  transition-all
`;

const SELECT_CLS = `
  w-full rounded-lg border px-3 py-2
  bg-slate-800/50 text-slate-100 text-sm border-slate-700
  focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50
  transition-all cursor-pointer
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
      {error && (
        <span className="text-xs text-red-400 h-3.5 mt-0.5">{error}</span>
      )}
      {!error && <span className="text-xs h-3.5"></span>}
    </label>
  );
}

function Section({ title, icon: Icon, children, compact = false }) {
  return (
    <div className={compact ? "space-y-1" : "space-y-4"}>
      <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
        {Icon && <Icon className="w-4 h-4 text-slate-400" />}
        <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
      </div>
      <div className={compact ? "space-y-1" : "space-y-4"}>
        {children}
      </div>
    </div>
  );
}

export default function ProductForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get("id");
  const fileInputRef = useRef(null);

  const isEdit = !!productId;
  const isNew = location.pathname.includes("/new");

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    brand: "",
    size: "",
    unit: "piece",
    barcode: "",
    supplier: "",
    sku: "",
    stock: {
      quantity: "",
      lowStockThreshold: "",
      trackStock: false,
    },
    isActive: true,
  });

  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const { showToast, removeToast, toasts } = useToast();
  const handleApiError = useApiError();

  // Categories list
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const cats = await apiGet("/api/products/categories");
        setCategories(Array.isArray(cats) ? cats : []);
      } catch {}
    })();
  }, []);

  // Load product data for edit
  useEffect(() => {
    if (isEdit && productId) {
      setLoading(true);
      (async () => {
        try {
          const product = await apiGet(`/api/products/${productId}`);
          setForm({
            name: product.name || "",
            description: product.description || "",
            price: String(product.price || ""),
            category: product.category || "",
            brand: product.brand || "",
            size: product.size || "",
            unit: product.unit || "piece",
            barcode: product.barcode || "",
            supplier: product.supplier || "",
            sku: product.sku || "",
            imageUrl: product.imageUrl || null,
            stock: {
              quantity: String(product.stock?.quantity || ""),
              lowStockThreshold: String(product.stock?.lowStockThreshold || ""),
              trackStock: product.stock?.trackStock || false,
            },
            isActive: product.isActive !== undefined ? product.isActive : true,
          });
          if (product.imageUrl) {
            setImagePreview(product.imageUrl);
          }
        } catch (e) {
          setErr(e.message || "Failed to load product");
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [isEdit, productId]);

  function onChange(e) {
    const { name, value, type, checked } = e.target;
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    
    if (name.startsWith("stock.")) {
      const field = name.split(".")[1];
      setForm((prev) => ({
        ...prev,
        stock: {
          ...prev.stock,
          [field]: type === "checkbox" ? checked : value,
        },
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
    }
  }

  async function handleImageUpload(file) {
    if (!file) return null;
    
    setUploadingImage(true);
    try {
      // Convert file to base64 data URI
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result; // This is already a data URI
          resolve(base64String);
        };
        reader.onerror = () => {
          reject(new Error("Failed to read image file"));
        };
        reader.readAsDataURL(file);
      });
    } catch (error) {
      throw new Error("Failed to process image. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) {
      // Reset input value if no file selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors((prev) => ({ ...prev, image: "Image must be less than 5MB" }));
      // Reset input value on error
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.onerror = () => {
      setFieldErrors((prev) => ({ ...prev, image: "Failed to read image file" }));
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
    setFieldErrors((prev) => ({ ...prev, image: "" }));
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    setForm((prev) => ({ ...prev, imageUrl: null }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function validate() {
    const errors = {};
    if (!form.name.trim()) errors.name = "Product name is required";
    if (!form.price || Number(form.price) < 0) errors.price = "Valid price is required";
    if (form.stock.trackStock) {
      if (form.stock.quantity === "" || Number(form.stock.quantity) < 0)
        errors.stockQuantity = "Valid stock quantity is required";
      if (form.stock.lowStockThreshold === "" || Number(form.stock.lowStockThreshold) < 0)
        errors.lowStockThreshold = "Valid low stock threshold is required";
    }
    setFieldErrors(errors);
    return { ok: Object.keys(errors).length === 0, errors };
  }

  async function onSubmit(e) {
    e.preventDefault();
    const v = validate();
    setErr("");
    if (!v.ok) return;

    let imageUrl = null;
    
    // If image was removed (no preview), imageUrl stays null
    if (!imagePreview) {
      imageUrl = null;
    } else if (imageFile) {
      // Upload new image if selected
      try {
        imageUrl = await handleImageUpload(imageFile);
      } catch (error) {
        setErr(error.message);
        return;
      }
    } else {
      // If there's a preview but no new file, use existing imageUrl (for edit mode)
      imageUrl = form.imageUrl || null;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      imageUrl,
      brand: form.brand.trim() || null,
      size: form.size.trim() || null,
      unit: form.unit,
      barcode: form.barcode.trim() || null,
      supplier: form.supplier.trim() || null,
      category: form.category.trim() || null,
      sku: form.sku.trim() || null,
      stock: {
        quantity: form.stock.trackStock ? Number(form.stock.quantity || 0) : 0,
        lowStockThreshold: form.stock.trackStock ? Number(form.stock.lowStockThreshold || 10) : 10,
        trackStock: Boolean(form.stock.trackStock),
      },
      isActive: Boolean(form.isActive),
    };

    try {
      setBusy(true);
      if (isEdit) {
        await apiPatch(`/api/products/${productId}`, payload);
        showToast("Product updated successfully", "success");
      } else {
        await apiPost("/api/products", payload);
        showToast("Product created successfully", "success");
      }
      navigate("/admin/products");
    } catch (e) {
      handleApiError(e);
      // Also set error for inline display (optional, can remove if only toast is desired)
      setErr(e.message || (isEdit ? "Failed to save product." : "Failed to create product."));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div>
        <div className="text-center text-slate-400">Loading product...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
        <Breadcrumb
          items={[
            { label: "Products", path: "/admin/products" },
            { label: isEdit ? "Edit Product" : "New Product", path: location.pathname },
          ]}
        />
        <h1 className="text-2xl font-bold text-slate-100 mb-6">
          {isEdit ? "Edit Product" : "Add New Product"}
        </h1>

        <form id="product-form" onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Form Fields */}
          <div className="lg:col-span-2 space-y-6">
            {err && (
              <div className="rounded-lg px-4 py-3 text-sm border bg-red-500/15 text-red-300 border-red-500/30">
                {err}
              </div>
            )}

            {/* General Information */}
            <Section title="General Information" icon={FileText}>
              <Field label="Product Name" error={fieldErrors.name} required>
                <input
                  name="name"
                  value={form.name}
                  onChange={onChange}
                  className={INPUT_CLS}
                  placeholder="e.g. Aloe Vera Clay Face Mask"
                />
              </Field>

              <Field label="Description">
                <textarea
                  name="description"
                  value={form.description}
                  onChange={onChange}
                  rows={4}
                  className={INPUT_CLS}
                  placeholder="Write a detailed description of the product...."
                />
              </Field>
            </Section>

            {/* Product Details */}
            <Section title="Product Details" icon={Tag}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Brand">
                  <input
                    name="brand"
                    value={form.brand}
                    onChange={onChange}
                    className={INPUT_CLS}
                    placeholder="e.g. Magic Cosmetics"
                  />
                </Field>
                <Field label="Supplier">
                  <input
                    name="supplier"
                    value={form.supplier}
                    onChange={onChange}
                    className={INPUT_CLS}
                    placeholder="Select supplier"
                  />
                </Field>
                <Field label="Category">
                  {form.category && categories.includes(form.category) ? (
                    <select
                      name="category"
                      value={form.category}
                      onChange={onChange}
                      className={SELECT_CLS}
                    >
                      <option value="">Select category</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div>
                      <select
                        name="category"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            setForm((prev) => ({ ...prev, category: e.target.value }));
                          }
                        }}
                        className={SELECT_CLS}
                      >
                        <option value="">Select category</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        name="category"
                        value={form.category}
                        onChange={onChange}
                        className={`${INPUT_CLS} mt-2`}
                        placeholder="Or type a new category..."
                      />
                    </div>
                  )}
                </Field>
                <Field label="Size">
                  <input
                    name="size"
                    value={form.size}
                    onChange={onChange}
                    className={INPUT_CLS}
                    placeholder="e.g. 400"
                  />
                </Field>
                <Field label="Unit">
                  <select name="unit" value={form.unit} onChange={onChange} className={SELECT_CLS}>
                    <option value="piece">Piece</option>
                    <option value="pack">Pack</option>
                    <option value="bottle">Bottle</option>
                    <option value="box">Box</option>
                    <option value="set">Set</option>
                  </select>
                </Field>
                <Field label="Price (£)" error={fieldErrors.price} required>
                  <input
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={onChange}
                    className={INPUT_CLS}
                    placeholder="0.00"
                  />
                </Field>
              </div>
            </Section>

            {/* Identification */}
            <Section title="Identification" icon={Grid}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="SKU">
                  <input
                    name="sku"
                    value={form.sku}
                    onChange={onChange}
                    className={INPUT_CLS}
                    placeholder="e.g. FM-001"
                  />
                </Field>
                <Field label="Barcode">
                  <div className="relative">
                    <input
                      name="barcode"
                      value={form.barcode}
                      onChange={onChange}
                      className={INPUT_CLS}
                      placeholder="Scan or enter barcode"
                    />
                    {form.barcode && (
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, barcode: "" }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </Field>
              </div>
            </Section>

            {/* Stock Management */}
            <Section title="Stock Management" icon={Tag}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="stock.trackStock"
                  checked={form.stock.trackStock}
                  onChange={onChange}
                  className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="text-sm text-slate-300">
                  Track stock for this product
                </span>
              </label>

              {form.stock.trackStock && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <Field label="Current Stock" error={fieldErrors.stockQuantity}>
                    <input
                      name="stock.quantity"
                      type="number"
                      min="0"
                      value={form.stock.quantity}
                      onChange={onChange}
                      className={INPUT_CLS}
                      placeholder="0"
                    />
                  </Field>
                  <Field label="Low Stock Threshold" error={fieldErrors.lowStockThreshold}>
                    <input
                      name="stock.lowStockThreshold"
                      type="number"
                      min="0"
                      value={form.stock.lowStockThreshold}
                      onChange={onChange}
                      className={INPUT_CLS}
                      placeholder="10"
                    />
                  </Field>
                </div>
              )}
            </Section>
          </div>

          {/* Right Column - Status & Image */}
          <div className="lg:col-span-1 space-y-6">
            {/* Product Status */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <ToggleLeft className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-300">Product Status</h3>
              </div>
              <div className="space-y-1">
                <div className="h-4"></div>
                <div className="flex items-center justify-between w-full rounded-lg border px-3 py-2 bg-slate-800/50 border-slate-700 h-[42px]">
                  <span className="text-sm text-slate-500">
                    Toggle to hide this product from customers
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={form.isActive}
                      onChange={onChange}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-sky-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Product Image */}
            <Section title="Product Image" icon={Camera}>
              <Field error={fieldErrors.image}>
                <div className="space-y-3">
                  {imagePreview ? (
                    <div className="relative group w-full aspect-square">
                      <div className="relative w-full h-full rounded-lg border-2 border-slate-700 overflow-hidden bg-slate-800/30">
                        <img
                          src={(() => {
                            let normalized = imagePreview;
                            if (typeof imagePreview === "string" && imagePreview.startsWith("/uploads/products/")) {
                              normalized = imagePreview.replace("/uploads/products/", "/api/files/products/");
                            }
                            return normalized.startsWith("http") || normalized.startsWith("data:") 
                              ? normalized 
                              : `${API_URL}${normalized}`;
                          })()}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.error("Image load error:", imagePreview);
                            e.target.style.display = "none";
                          }}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeImage();
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-slate-900/90 backdrop-blur-sm text-slate-300 rounded-md hover:bg-red-600 hover:text-white shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10"
                          title="Remove image"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label
                      htmlFor="image-upload"
                      className="w-full aspect-square rounded-lg border-2 border-dashed border-slate-700 flex flex-col items-center justify-center bg-slate-800/30 gap-3 p-6 cursor-pointer hover:border-slate-600 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-slate-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-300">Click to upload</p>
                        <p className="text-xs text-slate-500 mt-1">PNG, JPG up to 5MB</p>
                      </div>
                    </label>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    id="image-upload"
                  />
                  {imagePreview && (
                    <label
                      htmlFor="image-upload"
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-200 text-sm font-medium cursor-pointer hover:bg-slate-800 hover:border-slate-600 transition-colors"
                    >
                      Change Image
                    </label>
                  )}
                </div>
              </Field>
            </Section>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-700 lg:col-span-3">
            <button
              type="submit"
              disabled={busy || uploadingImage || !form.name.trim() || !form.price}
              className="px-6 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {busy ? "Saving…" : uploadingImage ? "Uploading…" : isEdit ? "Save Product" : "Save Product"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin/products")}
              className="px-6 py-3 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition-colors ml-auto"
            >
              Discard
            </button>
          </div>
        </form>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
