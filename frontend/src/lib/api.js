/**
 * API Helper - Tüm API çağrıları için token'ı otomatik ekler
 */
import { API_URL } from "./config.js";
import { getToken } from "../features/auth/auth.js";

/**
 * Authenticated fetch - Token'ı otomatik ekler
 */
export async function apiFetch(url, options = {}) {
  const token = getToken();
  
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
  });
  
  // 401 Unauthorized - token geçersiz veya süresi dolmuş
  if (response.status === 401) {
    // Token'ı temizle ve login'e yönlendir
    localStorage.removeItem("ms_token");
    localStorage.removeItem("ms_user");
    window.location.replace("/login");
    throw new Error("Authentication required");
  }
  
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { error: `Request failed with status ${response.status}` };
    }
    const error = new Error(errorData.error || errorData.message || "Request failed");
    error.response = response;
    error.data = errorData;
    throw error;
  }
  
  return response.json();
}

/**
 * GET request
 */
export function apiGet(url, options = {}) {
  return apiFetch(url, { ...options, method: "GET" });
}

/**
 * POST request
 */
export function apiPost(url, data, options = {}) {
  return apiFetch(url, {
    ...options,
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * PATCH request
 */
export function apiPatch(url, data, options = {}) {
  return apiFetch(url, {
    ...options,
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/**
 * PUT request
 */
export function apiPut(url, data, options = {}) {
  return apiFetch(url, {
    ...options,
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * DELETE request
 */
export function apiDelete(url, options = {}) {
  return apiFetch(url, { ...options, method: "DELETE" });
}

