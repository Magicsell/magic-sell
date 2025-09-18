import React from "react";

export function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  const color =
    s === "delivered"
      ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
      : "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30";
  const label = s === "delivered" ? "Delivered" : "Pending";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

export function PaymentBadge({ method }) {
  const m = (method || "").toString();
  const lower = m.trim().toLowerCase();
  let color = "bg-neutral-800 text-neutral-300 ring-1 ring-neutral-700/30";
  if (lower.includes("card"))
    color = "bg-blue-500/10 text-blue-300 ring-1 ring-blue-400/20";
  else if (lower.includes("cash"))
    color = "bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/20";
  else if (lower.includes("balance"))
    color = "bg-purple-500/10 text-purple-300 ring-1 ring-purple-400/20";
  else if (lower.includes("bank") || lower.includes("transfer"))
    color = "bg-lime-500/10 text-lime-300 ring-1 ring-lime-400/20";
  const label = m ? titleCase(m) : "Not Set";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function titleCase(s) {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default { StatusBadge, PaymentBadge };
