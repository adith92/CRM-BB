import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, tokenStore } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    if (!tokenStore.getAccess() && !tokenStore.getSession()) {
      setUser(null);
      return null;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      return data;
    } catch {
      tokenStore.clearAll();
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    fetchMe().finally(() => setLoading(false));
  }, [fetchMe]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.access_token) tokenStore.setAccess(data.access_token);
    if (data.refresh_token) tokenStore.setRefresh(data.refresh_token);
    setUser(data);
    return data;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    if (data.access_token) tokenStore.setAccess(data.access_token);
    if (data.refresh_token) tokenStore.setRefresh(data.refresh_token);
    setUser(data);
    return data;
  };

  const logout = async () => {
    try { 
      await api.post("/auth/logout"); 
    } catch (error) {
      // Logout API call failed, but we still clear local tokens
      console.error("Logout API failed:", error);
    }
    tokenStore.clearAll();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh: fetchMe, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
