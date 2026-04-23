import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const TOKEN_KEY = "relay_access_token";
const REFRESH_KEY = "relay_refresh_token";
const SESSION_KEY = "relay_session_token";

/**
 * Token storage using localStorage
 * 
 * Note: Backend also sets httpOnly cookies as primary auth mechanism.
 * localStorage tokens are used as fallback for Bearer token auth.
 * For production apps with high security requirements, consider:
 * - Using only httpOnly cookies (remove localStorage)
 * - Implementing additional CSRF protection
 * - Using a secure session management library
 */
export const tokenStore = {
  getAccess: () => localStorage.getItem(TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  getSession: () => localStorage.getItem(SESSION_KEY),
  setAccess: (t) => t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY),
  setRefresh: (t) => t ? localStorage.setItem(REFRESH_KEY, t) : localStorage.removeItem(REFRESH_KEY),
  setSession: (t) => t ? localStorage.setItem(SESSION_KEY, t) : localStorage.removeItem(SESSION_KEY),
  clearAll: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(SESSION_KEY);
  },
};

export const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess() || tokenStore.getSession();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function formatApiError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
