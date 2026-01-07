import { useEffect, useState } from "react";
import { API_URL } from "../lib/config";
import { apiPatch } from "../lib/api";
import { getToken } from "../features/auth/auth";
import { X, Upload, Image as ImageIcon, CheckCircle } from "lucide-react";

export default function DeliverModal({ open, onClose, order, onSuccess }) {
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Reset on open
  useEffect(() => {
    if (!open) return;
    // Use order's payment method if available, otherwise default to Cash
    setPaymentMethod(order?.paymentMethod || "Cash");
    setNotes("");
    setFile(null);
    setPreview("");
    setErr("");
  }, [open, order]);

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
    const token = getToken();
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const r = await fetch(`${API_URL}/api/files/proof`, {
      method: "POST",
      headers,
      body: fd,
    });
    if (!r.ok) {
      const errorText = await r.text();
      throw new Error(errorText || "Proof upload failed");
    }
    const d = await r.json();
    return d.url;
  }

  async function submit() {
    try {
      setBusy(true);
      setErr("");

      const proofUrl = file ? await uploadProof() : null;

      await apiPatch(`/api/orders/${order.id}/deliver`, {
        paymentMethod,
        notes: notes || null,
        proofUrl,
      });

      onSuccess?.();
      onClose?.();
    } catch (e) {
      setErr(e.message || "Error completing delivery");
    } finally {
      setBusy(false);
    }
  }

  function handleFileChange(e) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.type.startsWith("image/")) {
        setErr("Please select an image file");
        return;
      }
      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setErr("Image size must be less than 10MB");
        return;
      }
      setFile(selectedFile);
      setErr("");
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-slate-100">Complete Delivery</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            disabled={busy}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Info */}
        <div className="px-6 py-4 bg-slate-800/30 border-b border-slate-800">
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-slate-400">Order:</span>{" "}
                <span className="font-medium text-slate-200">{order?.title || `#${order?.id}`}</span>
              </div>
              <div className="h-4 w-px bg-slate-700" />
              <div>
                <span className="text-slate-400">Amount:</span>{" "}
                <span className="font-medium text-slate-200">£{Number(order?.amount || 0).toFixed(2)}</span>
              </div>
              <div className="h-4 w-px bg-slate-700" />
              <div>
                <span className="text-slate-400">Payment:</span>{" "}
                <span className="font-medium text-slate-200">{order?.paymentMethod || "Not Set"}</span>
              </div>
            </div>
            
            {/* Payment Breakdown */}
            {order?.paymentBreakdown && (
              order.paymentBreakdown.balanceAmount > 0 ||
              order.paymentBreakdown.cashAmount > 0 ||
              order.paymentBreakdown.cardAmount > 0 ||
              order.paymentBreakdown.bankAmount > 0
            ) && (
              <div className="pt-2 border-t border-slate-700">
                <div className="text-xs text-slate-400 mb-2">Payment Breakdown:</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {order.paymentBreakdown.balanceAmount > 0 && (
                    <div>
                      <span className="text-slate-500">Balance:</span>{" "}
                      <span className="font-medium text-slate-200">
                        £{Number(order.paymentBreakdown.balanceAmount || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {order.paymentBreakdown.cashAmount > 0 && (
                    <div>
                      <span className="text-slate-500">Cash:</span>{" "}
                      <span className="font-medium text-slate-200">
                        £{Number(order.paymentBreakdown.cashAmount || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {order.paymentBreakdown.cardAmount > 0 && (
                    <div>
                      <span className="text-slate-500">Card:</span>{" "}
                      <span className="font-medium text-slate-200">
                        £{Number(order.paymentBreakdown.cardAmount || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {order.paymentBreakdown.bankAmount > 0 && (
                    <div>
                      <span className="text-slate-500">Bank:</span>{" "}
                      <span className="font-medium text-slate-200">
                        £{Number(order.paymentBreakdown.bankAmount || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {err && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-3 text-sm">
              {err}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {/* Left Column - Form */}
            <div className="space-y-4">
              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all opacity-60 cursor-not-allowed"
                  disabled={true}
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Balance">Balance</option>
                  <option value="Split">Split Payment</option>
                  <option value="Not Set">Not Set</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Payment method is set by admin and cannot be changed
                </p>
              </div>

              {/* Delivery Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Delivery Notes <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all resize-none"
                  placeholder="Add any delivery notes..."
                  disabled={busy}
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Proof Photo <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                    id="proof-upload"
                    disabled={busy}
                  />
                  <label
                    htmlFor="proof-upload"
                    className="flex items-center justify-center gap-2 w-full rounded-lg border-2 border-dashed border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300 hover:border-emerald-500/50 hover:bg-slate-900 transition-colors cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{file ? "Change photo" : "Upload photo"}</span>
                  </label>
                </div>
                {file && (
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setPreview("");
                      const input = document.getElementById("proof-upload");
                      if (input) input.value = "";
                    }}
                    className="mt-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                    disabled={busy}
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>

            {/* Right Column - Preview */}
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Preview
              </label>
              <div className="flex-1 rounded-lg border border-slate-800 bg-slate-950 p-4 flex items-center justify-center min-h-[280px]">
                {preview ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={preview}
                      alt="Proof preview"
                      className="max-h-[260px] max-w-full object-contain rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-500">
                    <ImageIcon className="w-12 h-12" />
                    <span className="text-sm">No photo selected</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 text-sm font-medium hover:bg-slate-800 hover:border-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Complete Delivery
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
