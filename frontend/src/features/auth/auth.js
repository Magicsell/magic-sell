// src/features/auth/auth.js
import { API_URL } from "../../lib/config.js";

const TOKEN_KEY = "ms_token";
const USER_KEY = "ms_user";

/**
 * JWT Token'ı localStorage'a kaydet
 */
function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * JWT Token'ı localStorage'dan al
 */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * User bilgisini localStorage'a kaydet
 */
function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("ms-auth"));
}

/**
 * User bilgisini localStorage'dan al
 */
export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY)) || null;
  } catch {
    return null;
  }
}

/**
 * Login - Backend API'ye bağlan
 */
export async function login(email, password) {
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Login failed");
    }

    const data = await response.json();
    
    // Token ve user bilgisini kaydet
    setToken(data.token);
    setUser({
      _id: data.user._id,
      email: data.user.email,
      role: data.user.role,
      organizationId: data.user.organizationId,
    });

    return data.user;
  } catch (error) {
    throw error;
  }
}

/**
 * Logout
 */
export function logout(redirect = true) {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("ms-auth"));
  if (redirect) {
    window.location.replace("/login");
  }
}

/**
 * Auth değişikliklerini dinle
 */
export function onAuthChange(cb) {
  const handler = () => cb(getUser());
  window.addEventListener("ms-auth", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("ms-auth", handler);
    window.removeEventListener("storage", handler);
  };
}

/**
 * API çağrıları için header'a token ekle
 */
export function getAuthHeaders() {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}
