import { useEffect, useState } from "react";
import { API_URL } from "../lib/config";

export default function DeliverModal({ open, onClose, order, onSuccess }) {
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // modal her açılışta temiz başlasın
  useEffect(() => {
    if (!open) return;
    setPaymentMethod("Cash");
    setNotes("");
    setFile(null);
    setPreview("");
    setErr("");
  }, [open]);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!open) return null;

  async function uploadProof() {
    if (!file) return null;
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch(`${API_URL}/api/files/proof`, { method: "POST", body: fd });
    if (!r.ok) throw new Error("Proof upload failed");
    const d = await r.json();
    return d.url;
  }

  async function submit() {
    try {
      setBusy(true);
      setErr("");

      const proofUrl = file ? await uploadProof() : null;

      const r2 = await fetch(`${API_URL}/api/orders/${order.id}/deliver`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod,
          notes: notes || null,
          proofUrl,
        }),
      });
      if (!r2.ok) throw new Error("Deliver API failed");

      onSuccess?.();
      onClose?.();
    } catch (e) {
      setErr(e.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-[min(92vw,820px)] rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">Complete Delivery</div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="text-sm text-slate-400 mb-4">
          Order:{" "}
          <b className="text-slate-200">{order?.title || `#${order?.id}`}</b>{" "}
          • Amount:{" "}
          <b className="text-slate-200">£{Number(order?.amount || 0).toFixed(2)}</b>
        </div>

        {err && (
          <div className="mb-3 rounded-lg bg-red-500/10 text-red-300 px-3 py-2 text-sm border border-red-500/30">
            {err}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-slate-300">Payment method</span>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="rounded-lg bg-slate-950 px-3 py-2 ring-1 ring-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Balance">Balance</option>
                <option value="Not Set">Not Set</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-slate-300">Delivery notes</span>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-lg bg-slate-950 px-3 py-2 ring-1 ring-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Optional"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-slate-300">Proof photo (optional)</span>
              {/* telefonda direkt kamerayı önermek için */}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="text-slate-300"
              />
            </label>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 min-h-[220px] flex items-center justify-center">
            {preview ? (
              <img src={preview} alt="Preview" className="max-h-[300px] w-full object-contain rounded-lg" />
            ) : (
              <span className="text-sm text-slate-500">No photo selected.</span>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          {file && (
            <button
              type="button"
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
              onClick={() => setFile(null)}
            >
              Remove photo
            </button>
          )}
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-60"
            onClick={submit}
            disabled={busy}
          >
            {busy ? "Saving…" : "Complete delivery"}
          </button>
        </div>
      </div>
    </div>
  );
}
