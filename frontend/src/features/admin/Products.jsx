import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiDelete } from "../../lib/api";
import { API_URL } from "../../lib/config";
import { Pencil, Trash2, Plus, Search, Image as ImageIcon, Package, Tag, Package2, ShoppingCart, ChevronDown } from "lucide-react";
import Breadcrumb from "../../components/Breadcrumb";
import Pagination from "../../components/Pagination";

// Tab component for status filters (same style as Orders page)
function Tab({ active, children, ...p }) {
  return (
    <button
      {...p}
      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
        active
          ? "bg-sky-600/80 text-white"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
      }`}
    >
      {children}
    </button>
  );
}

// Product Image Component for Card View
function ProductImage({ imageUrl, alt, category }) {
  const [imgError, setImgError] = useState(false);
  
  // Normalize image URL: /uploads/products/... -> /api/files/products/...
  let normalizedUrl = imageUrl;
  if (imageUrl && imageUrl.startsWith("/uploads/products/")) {
    normalizedUrl = imageUrl.replace("/uploads/products/", "/api/files/products/");
  }
  
  const imageSrc = imageUrl && !imgError
    ? (normalizedUrl.startsWith("http") || normalizedUrl.startsWith("data:")
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
          onError={(e) => {
            console.error("Image load error:", imageSrc, "Original URL:", imageUrl);
            setImgError(true);
          }}
        />
      ) : (
        <ImageIcon className="w-16 h-16 text-slate-600" />
      )}
      {/* Category Badge - Top Left */}
      {category && (
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-slate-900/90 backdrop-blur-sm text-xs font-semibold text-slate-200 uppercase tracking-wide">
          {category}
        </div>
      )}
    </div>
  );
}

export default function Products() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isActiveFilter, setIsActiveFilter] = useState("all");
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // Admin → Delete
  async function handleDelete(productId, productName) {
    if (!confirm(`Delete "${productName}" permanently?`)) return;

    try {
      await apiDelete(`/api/products/${productId}`);
      await fetchProducts(page, categoryFilter, isActiveFilter, q);
    } catch (e) {
      alert(e.message || "Delete failed");
    }
  }

  // Fetch categories
  useEffect(() => {
    (async () => {
      try {
        const cats = await apiGet("/api/products/categories");
        setCategories(Array.isArray(cats) ? cats : []);
      } catch {}
    })();
  }, []);

  // server'dan çek
  async function fetchProducts(nextPage = page, nextCategory = categoryFilter, nextIsActive = isActiveFilter, nextQ = q, nextPageSize = pageSize) {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(nextPageSize));
    if (nextCategory && nextCategory !== "all") {
      params.set("category", nextCategory);
    }
    if (nextIsActive && nextIsActive !== "all") {
      params.set("isActive", nextIsActive);
    }
    if (nextQ.trim()) params.set("q", nextQ.trim());

    try {
      const url = `/api/products?${params.toString()}`;
      const data = await apiGet(url);
      const list = Array.isArray(data) ? data : data.items ?? [];
      setRows(list);
      setPage(Number(data.page || nextPage));
      setPages(Number(data.pages || data.totalPages || 1));
      setTotal(Number(data.total || list.length));
    } catch (e) {
      console.error("Failed to fetch products:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProducts(1, "all", "all", q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // UI eventleri
  function onChangeCategory(v) {
    setCategoryFilter(v);
    setPage(1);
    fetchProducts(1, v, isActiveFilter, q);
  }
  function onChangeIsActive(v) {
    setIsActiveFilter(v);
    setPage(1);
    fetchProducts(1, categoryFilter, v, q);
  }
  function onSearchSubmit(e) {
    e.preventDefault();
    setPage(1);
    fetchProducts(1, categoryFilter, isActiveFilter, q);
  }
  
  // Auto-refresh when search is cleared
  useEffect(() => {
    if (!q.trim()) {
      // Search is empty, refresh to show all
      setPage(1);
      fetchProducts(1, categoryFilter, isActiveFilter, "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  
  function onChangePageSize(newSize) {
    const newPageSize = Number(newSize);
    setPageSize(newPageSize);
    setPage(1);
    fetchProducts(1, categoryFilter, isActiveFilter, q, newPageSize);
  }


  return (
    <div>
        {/* Header */}
        <Breadcrumb
          items={[{ label: "Products", path: "/admin/products" }]}
          actionButton={
            <button
              onClick={() => navigate("/admin/products/new")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600/80 px-3 py-1.5 text-white text-sm font-medium hover:bg-sky-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Product
            </button>
          }
        />

          {/* Category Filter, Status Filter & Search */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {/* Left side: Status Tabs */}
            <div className="inline-flex rounded-xl p-1 border border-slate-800 bg-slate-900/60">
              <Tab active={isActiveFilter === "all"} onClick={() => onChangeIsActive("all")}>
                All
              </Tab>
              <Tab active={isActiveFilter === "true"} onClick={() => onChangeIsActive("true")}>
                Active
              </Tab>
              <Tab active={isActiveFilter === "false"} onClick={() => onChangeIsActive("false")}>
                Inactive
              </Tab>
            </div>

            {/* Right side: Category Selectbox & Search */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full sm:w-auto">
              {/* Category Selectbox */}
              <div className="relative w-full sm:w-auto">
                <select
                  value={categoryFilter}
                  onChange={(e) => onChangeCategory(e.target.value)}
                  className="appearance-none pl-4 pr-10 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600 focus:border-transparent w-full sm:w-48 cursor-pointer"
                >
                  <option value="all">All Items</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>

              {/* Search */}
              <form onSubmit={onSearchSubmit} className="flex gap-2 w-full sm:w-auto">
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
          </div>

        {/* Product Grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading products...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-4 text-lg">No products found.</p>
            <button
              onClick={() => navigate("/admin/products/new")}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600/80 px-4 py-2 text-white font-medium hover:bg-emerald-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create your first product
            </button>
          </div>
        ) : (
          <>
            {/* Product Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {rows.map((product) => {
                const stock = product.stock;
                const isLowStock = stock?.trackStock && stock.quantity <= stock.lowStockThreshold;
                
                return (
                  <div
                    key={product._id}
                    onClick={(e) => {
                      // Don't navigate if clicking on buttons
                      if (e.target.closest('button')) return;
                      navigate(`/admin/products/edit?id=${product._id}`);
                    }}
                    className="group bg-slate-900/60 backdrop-blur rounded-xl border border-slate-800 shadow-lg overflow-hidden hover:border-slate-700 hover:shadow-xl transition-all flex flex-col cursor-pointer"
                  >
                    {/* Product Image with Category Badge */}
                    <ProductImage imageUrl={product.imageUrl} alt={product.name} category={product.category} />

                    {/* Product Info */}
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

                      {/* Price & Action Button */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-800/50">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-slate-100">
                            £{Number(product.price || 0).toFixed(2)}
                          </span>
                          {stock?.trackStock && (
                            <span className="text-xs text-slate-500 font-medium">
                              • {stock.quantity} in stock
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/products/edit?id=${product._id}`);
                            }}
                            className="p-2.5 rounded-lg bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(product._id, product.name);
                            }}
                            className="p-2.5 rounded-lg bg-slate-800/50 text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <Pagination
              page={page}
              pages={pages}
              pageSize={pageSize}
              total={total}
              itemsCount={rows.length}
              itemLabel="products"
              onPageChange={(newPage) => {
                if (newPage >= 1 && newPage <= pages) {
                  fetchProducts(newPage, categoryFilter, isActiveFilter, q);
                }
              }}
              onPageSizeChange={onChangePageSize}
              className="mt-8 rounded-b-xl"
            />
          </>
        )}
    </div>
  );
}
