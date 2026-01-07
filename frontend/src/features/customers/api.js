import { apiGet, apiPost, apiPut, apiDelete } from "../../lib/api";

export async function listCustomers(q = "", page = 1, pageSize = 20) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("page", page);
  params.set("pageSize", pageSize);
  return apiGet(`/api/customers?${params.toString()}`);
}

export async function createCustomer(payload) {
  return apiPost("/api/customers", payload);
}

export async function updateCustomer(id, payload) {
  return apiPut(`/api/customers/${id}`, payload);
}

export async function deleteCustomer(id) {
  return apiDelete(`/api/customers/${id}`);
}
