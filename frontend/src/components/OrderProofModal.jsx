import { createPortal } from "react-dom";
import { API_URL } from "../lib/config";

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
      : `${API_URL}${order.proofUrl}`
    : null;

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
