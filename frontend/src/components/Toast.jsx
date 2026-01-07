import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, X, AlertCircle, Info } from "lucide-react";

const toastContainer = {
  position: "fixed",
  top: "20px",
  right: "20px",
  zIndex: 10000,
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

export function useToast() {
  const [toasts, setToasts] = useState([]);

  function removeToast(id) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function showToast(message, type = "success", duration = 5000) {
    const id = Date.now() + Math.random();
    const toast = { id, message, type };
    setToasts((prev) => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }

  return { showToast, removeToast, toasts };
}

export function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;

  return createPortal(
    <div style={toastContainer}>
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>,
    document.body
  );
}

function Toast({ toast, onRemove }) {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-sky-400" />,
  };

  const bgColors = {
    success: "bg-emerald-500/10 border-emerald-500/30",
    error: "bg-red-500/10 border-red-500/30",
    info: "bg-sky-500/10 border-sky-500/30",
  };

  const textColors = {
    success: "text-emerald-300",
    error: "text-red-300",
    info: "text-sky-300",
  };

  return (
    <div
      className={`rounded-lg border backdrop-blur-sm shadow-lg p-4 min-w-[300px] max-w-[400px] flex items-start gap-3 transition-all animate-in slide-in-from-right-5 ${
        bgColors[toast.type] || bgColors.success
      }`}
    >
      <div className="flex-shrink-0 mt-0.5">{icons[toast.type] || icons.success}</div>
      <div className={`flex-1 text-sm ${textColors[toast.type] || textColors.success}`}>{toast.message}</div>
      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-slate-200 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
