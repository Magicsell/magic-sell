import { API_URL } from "../../lib/config";

export async function listCustomers(q = "", page = 1, pageSize = 20) {
  const u = new URL(`${API_URL}/api/customers`);
  if (q) u.searchParams.set("q", q);
  u.searchParams.set("page", page);
  u.searchParams.set("pageSize", pageSize);
  const r = await fetch(u);
  if (!r.ok) throw new Error("Failed to fetch customers");
  return r.json();
}

export async function createCustomer(payload) {
  const r = await fetch(`${API_URL}/api/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error("Failed to create customer");
  return r.json();
}
