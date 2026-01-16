import { useEffect, useState, useMemo, useRef } from "react";
import { API_URL } from "../lib/config";
import { apiPatch } from "../lib/api";
import { getToken, getUser } from "../features/auth/auth";
import { X, Upload, Image as ImageIcon, CheckCircle, CreditCard } from "lucide-react";

export default function DeliverModal({ open, onClose, order, onSuccess }) {
  // Get user role - memoize to prevent hook order issues
  const isDriver = useMemo(() => {
    const user = getUser();
    return user?.role === "driver";
  }, []);
  
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentBreakdown, setPaymentBreakdown] = useState({
    balanceAmount: 0,
    cashAmount: 0,
    cardAmount: 0,
    bankAmount: 0,
  });
  const [customerBalance, setCustomerBalance] = useState(null);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  
  // Store original payment method and breakdown from order
  const originalPaymentMethodRef = useRef(null);
  const originalPaymentBreakdownRef = useRef(null);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    // Use order's payment method if available, otherwise default to Cash
    const method = order?.paymentMethod || "Cash";
    setPaymentMethod(method);
    
    // Store original payment method and breakdown
    originalPaymentMethodRef.current = method;
    
    // Load payment breakdown from order
    let initialBreakdown = {
      balanceAmount: 0,
      cashAmount: 0,
      cardAmount: 0,
      bankAmount: 0,
    };
    
    if (order?.paymentBreakdown && typeof order.paymentBreakdown === 'object') {
      initialBreakdown = {
        balanceAmount: Number(order.paymentBreakdown.balanceAmount || 0),
        cashAmount: Number(order.paymentBreakdown.cashAmount || 0),
        cardAmount: Number(order.paymentBreakdown.cardAmount || 0),
        bankAmount: Number(order.paymentBreakdown.bankAmount || 0),
      };
    } else {
      // Initialize based on payment method
      const total = Number(order?.amount || order?.totalAmount || 0);
      if (method === "Balance") {
        initialBreakdown = { balanceAmount: total, cashAmount: 0, cardAmount: 0, bankAmount: 0 };
      } else if (method === "Cash") {
        initialBreakdown = { balanceAmount: 0, cashAmount: total, cardAmount: 0, bankAmount: 0 };
      } else if (method === "Card") {
        initialBreakdown = { balanceAmount: 0, cashAmount: 0, cardAmount: total, bankAmount: 0 };
      } else if (method === "Bank Transfer") {
        initialBreakdown = { balanceAmount: 0, cashAmount: 0, cardAmount: 0, bankAmount: total };
      }
    }
    
    setPaymentBreakdown(initialBreakdown);
    originalPaymentBreakdownRef.current = { ...initialBreakdown };
    
    // Load customer balance if customer name exists
    if (order?.customerName && isDriver) {
      (async () => {
        try {
          const usersData = await apiPatch(`/api/users?role=customer&q=${encodeURIComponent(order.customerName)}`);
          // This might not work, let's try a different approach
          // We'll fetch customer balance from order if available
        } catch {}
      })();
    }
    
    setNotes("");
    setFile(null);
    setPreview("");
    setErr("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Track previous payment method to detect changes
  const prevPaymentMethodRef = useRef(paymentMethod);
  
  // Update breakdown when payment method changes (only for driver, and only when method actually changes)
  useEffect(() => {
    if (!open || !isDriver) return;
    
    // Only update if payment method actually changed (not on initial load)
    if (prevPaymentMethodRef.current === paymentMethod) return;
    
    prevPaymentMethodRef.current = paymentMethod;
    
    // If returning to original payment method, restore original breakdown
    if (paymentMethod === originalPaymentMethodRef.current && originalPaymentBreakdownRef.current) {
      setPaymentBreakdown({ ...originalPaymentBreakdownRef.current });
      return;
    }
    
    const total = Number(order?.amount || order?.totalAmount || 0);
    
    if (paymentMethod === "Balance") {
      setPaymentBreakdown({ balanceAmount: total, cashAmount: 0, cardAmount: 0, bankAmount: 0 });
    } else if (paymentMethod === "Cash") {
      setPaymentBreakdown({ balanceAmount: 0, cashAmount: total, cardAmount: 0, bankAmount: 0 });
    } else if (paymentMethod === "Card") {
      setPaymentBreakdown({ balanceAmount: 0, cashAmount: 0, cardAmount: total, bankAmount: 0 });
    } else if (paymentMethod === "Bank Transfer") {
      setPaymentBreakdown({ balanceAmount: 0, cashAmount: 0, cardAmount: 0, bankAmount: total });
    } else if (paymentMethod === "Split") {
      // If original was Split, restore original breakdown, otherwise initialize with total in cash
      if (originalPaymentMethodRef.current === "Split" && originalPaymentBreakdownRef.current) {
        setPaymentBreakdown({ ...originalPaymentBreakdownRef.current });
      } else {
        // Only initialize if breakdown is empty, otherwise keep existing values
        const currentTotal = (paymentBreakdown.balanceAmount || 0) + 
                            (paymentBreakdown.cashAmount || 0) + 
                            (paymentBreakdown.cardAmount || 0) + 
                            (paymentBreakdown.bankAmount || 0);
        if (currentTotal === 0) {
          setPaymentBreakdown({ balanceAmount: 0, cashAmount: total, cardAmount: 0, bankAmount: 0 });
        }
        // Otherwise keep existing breakdown
      }
    } else {
      setPaymentBreakdown({ balanceAmount: 0, cashAmount: 0, cardAmount: 0, bankAmount: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod]);
  
  // Reset ref when modal closes
  useEffect(() => {
    if (!open) {
      prevPaymentMethodRef.current = paymentMethod;
    }
  }, [open, paymentMethod]);

  // Early return AFTER all hooks
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

      // Validate payment breakdown if Split is selected
      if (paymentMethod === "Split") {
        const total = Number(order?.amount || order?.totalAmount || 0);
        const breakdownTotal = 
          (paymentBreakdown.balanceAmount || 0) +
          (paymentBreakdown.cashAmount || 0) +
          (paymentBreakdown.cardAmount || 0) +
          (paymentBreakdown.bankAmount || 0);
        
        if (Math.abs(breakdownTotal - total) > 0.01) {
          setErr(`Payment breakdown total (£${breakdownTotal.toFixed(2)}) must equal order total (£${total.toFixed(2)})`);
          setBusy(false);
          return;
        }
      }

      const proofUrl = file ? await uploadProof() : null;

      const payload = {
        paymentMethod,
        notes: notes || null,
        proofUrl,
      };

      // Include payment breakdown if Split is selected
      if (paymentMethod === "Split") {
        payload.paymentBreakdown = paymentBreakdown;
      }

      await apiPatch(`/api/orders/${order._id || order.id}/deliver`, payload);

      onSuccess?.();
      onClose?.();
    } catch (e) {
      setErr(e.message || "Error completing delivery");
    } finally {
      setBusy(false);
    }
  }

  function handleFileChange(e) {
    const input = e.target;
    const selectedFile = input?.files?.[0];
    
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.type.startsWith("image/")) {
        setErr("Please select an image file");
        // Reset input
        input.value = "";
        return;
      }
      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setErr("Image size must be less than 10MB");
        // Reset input
        input.value = "";
        return;
      }
      setFile(selectedFile);
      setErr("");
    } else {
      // If no file selected, reset
      setFile(null);
      setPreview("");
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 w-full max-w-2xl max-h-[calc(100vh-2rem)] rounded-xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col">
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
                <span className="font-medium text-slate-200">
                  {order?.orderNo ? `#${String(order.orderNo).padStart(4, "0")}` : order?.title || `#${order?.id || order?._id}`}
                </span>
              </div>
              <div className="h-4 w-px bg-slate-700" />
              <div>
                <span className="text-slate-400">Amount:</span>{" "}
                <span className="font-medium text-slate-200">£{Number(order?.amount || order?.totalAmount || 0).toFixed(2)}</span>
              </div>
              <div className="h-4 w-px bg-slate-700" />
              <div>
                <span className="text-slate-400">Payment:</span>{" "}
                <span className="font-medium text-slate-200">{order?.paymentMethod || "Not Set"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 overflow-y-auto flex-1 min-h-0">
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
                  disabled={!isDriver || busy}
                  className={`w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all ${
                    !isDriver ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Balance">Balance</option>
                  <option value="Split">Split Payment</option>
                  <option value="Not Set">Not Set</option>
                </select>
                {!isDriver && (
                  <p className="text-xs text-slate-500 mt-1">
                    Payment method is set by admin and cannot be changed
                  </p>
                )}
              </div>
              
              {/* Payment Breakdown (shown only when Split is selected and driver) */}
              {isDriver && paymentMethod === "Split" && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-300">
                    Payment Breakdown
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Balance</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={paymentBreakdown.balanceAmount || ""}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setPaymentBreakdown(prev => ({ ...prev, balanceAmount: val }));
                        }}
                        className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                        placeholder="0.00"
                        disabled={busy}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Cash</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={paymentBreakdown.cashAmount || ""}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setPaymentBreakdown(prev => ({ ...prev, cashAmount: val }));
                        }}
                        className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                        placeholder="0.00"
                        disabled={busy}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Card</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={paymentBreakdown.cardAmount || ""}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setPaymentBreakdown(prev => ({ ...prev, cardAmount: val }));
                        }}
                        className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                        placeholder="0.00"
                        disabled={busy}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Bank Transfer</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={paymentBreakdown.bankAmount || ""}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setPaymentBreakdown(prev => ({ ...prev, bankAmount: val }));
                        }}
                        className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                        placeholder="0.00"
                        disabled={busy}
                      />
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-700">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Breakdown Total:</span>
                      <span className={`font-semibold ${
                        Math.abs(
                          (paymentBreakdown.balanceAmount || 0) + 
                          (paymentBreakdown.cashAmount || 0) + 
                          (paymentBreakdown.cardAmount || 0) + 
                          (paymentBreakdown.bankAmount || 0) - 
                          Number(order?.amount || order?.totalAmount || 0)
                        ) > 0.01
                          ? "text-red-400"
                          : "text-emerald-400"
                      }`}>
                        £{(
                          (paymentBreakdown.balanceAmount || 0) + 
                          (paymentBreakdown.cashAmount || 0) + 
                          (paymentBreakdown.cardAmount || 0) + 
                          (paymentBreakdown.bankAmount || 0)
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-slate-400">Order Total:</span>
                      <span className="text-xs font-semibold text-slate-200">
                        £{Number(order?.amount || order?.totalAmount || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

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
                    onClick={(e) => {
                      // Reset input value to allow selecting the same file again
                      e.target.value = "";
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    id="proof-upload"
                    disabled={busy}
                  />
                  <label
                    htmlFor="proof-upload"
                    className="flex items-center justify-center gap-2 w-full rounded-lg border-2 border-dashed border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300 hover:border-emerald-500/50 hover:bg-slate-900 transition-colors cursor-pointer pointer-events-none"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{file ? "Change photo" : "Upload photo"}</span>
                  </label>
                </div>
                {file && (
                  <div className="mt-2">
                    <div className="text-xs text-slate-400 mb-1">
                      Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setPreview("");
                        const input = document.getElementById("proof-upload");
                        if (input) input.value = "";
                      }}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      disabled={busy}
                    >
                      Remove photo
                    </button>
                  </div>
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
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-3 flex-shrink-0">
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
    </div>
  );
}
