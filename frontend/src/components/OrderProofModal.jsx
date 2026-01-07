import { createPortal } from "react-dom";
import { API_URL } from "../lib/config";
import { ShoppingCart, Image as ImageIcon } from "lucide-react";

export default function OrderProofModal({ open, onClose, order }) {
  if (!open) return null;

  const paid = order?.paymentMethod || "Not Set";

  // Başlıkta gösterilecek sipariş no (#0007 gibi)
  const displayNo =
    order?.orderNo != null
      ? pad(order.orderNo)
      : order?.seq != null
      ? String(order.seq)
      : shortId(order?._id);

  // proofUrl relatif gelirse API_URL ile tamamla
  const proofSrc = order?.proofUrl
    ? order.proofUrl.startsWith("http")
      ? order.proofUrl
      : order.proofUrl.startsWith("/uploads/proofs/")
      ? `${API_URL}/api/files/proofs/${order.proofUrl.split("/").pop()}`
      : order.proofUrl.startsWith("/api/files/proofs/")
      ? `${API_URL}${order.proofUrl}`
      : `${API_URL}${order.proofUrl}`
    : null;

  // Debug log
  if (order?.proofUrl) {
    console.log("[OrderProofModal] Original proofUrl:", order.proofUrl);
    console.log("[OrderProofModal] Resolved proofSrc:", proofSrc);
  }

  const deliveredAt = order?.deliveredAt
    ? new Date(order.deliveredAt).toLocaleString("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="absolute left-1/2 top-1/2 w-[90vw] max-w-2xl -translate-x-1/2 -translate-y-1/2
                    rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">Order #{displayNo}</div>
          <button className="text-slate-400 hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-lg overflow-hidden bg-slate-950 border border-slate-800 min-h-[220px] grid place-items-center">
            {proofSrc ? (
              // object-contain: büyük foto taşmasın
              <img
                src={proofSrc}
                alt="Delivery proof"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="p-6 text-sm text-slate-400">No proof uploaded.</div>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <div>
              <span className="text-slate-400">Customer:</span>{" "}
              <b>{order?.customerName || "-"}</b>
            </div>
            <div>
              <span className="text-slate-400">Shop:</span>{" "}
              <b>{order?.shopName || "-"}</b>
            </div>
            <div>
              <span className="text-slate-400">Payment:</span> <b>{paid}</b>
            </div>
            <div>
              <span className="text-slate-400">Delivered at:</span>{" "}
              <b>{deliveredAt}</b>
            </div>
            <div>
              <div className="text-slate-400">Notes</div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-2 min-h-[64px]">
                {order?.deliveryNotes || <span className="text-slate-500">—</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Order Items */}
        {order?.items && Array.isArray(order.items) && order.items.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Order Items</h3>
            <div className="space-y-2">
              {order.items.map((item, index) => {
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
                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-800 bg-slate-950/50"
                  >
                    {/* Product Image */}
                    <div className="w-12 h-12 rounded-lg border border-slate-700 bg-slate-800/50 flex-shrink-0 flex items-center justify-center overflow-hidden">
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
                        <ShoppingCart className="w-5 h-5 text-slate-600" />
                      </div>
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-100 truncate">
                        {item.productName || "Unknown Product"}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Quantity: {item.quantity || 0} × £{Number(item.price || 0).toFixed(2)}
                      </div>
                    </div>

                    {/* Subtotal */}
                    <div className="text-sm font-semibold text-slate-100">
                      £{Number(item.subtotal || 0).toFixed(2)}
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-slate-800 flex justify-end">
                <div className="text-sm">
                  <span className="text-slate-400">Items Total: </span>
                  <span className="font-bold text-emerald-400">
                    £{order.items.reduce((sum, item) => sum + (item.subtotal || 0), 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* helpers */
function pad(n) {
  const s = String(n ?? "");
  return s.length >= 4 ? s : "0".repeat(4 - s.length) + s;
}
function shortId(id) {
  return id ? String(id).slice(-6) : "-";
}
