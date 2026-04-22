import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError, tokenStore } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

export default function AuthCallback() {
  const processed = useRef(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { setUser } = useAuth();

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = window.location.hash || "";
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const sessionId = params.get("session_id");
    if (!sessionId) {
      navigate("/login", { replace: true });
      return;
    }

    (async () => {
      try {
        const { data } = await api.post("/auth/google/session", { session_id: sessionId });
        if (data.session_token) tokenStore.setSession(data.session_token);
        setUser(data);
        window.history.replaceState(null, "", "/fleet");
        navigate("/fleet", { replace: true, state: { user: data } });
      } catch (e) {
        setError(formatApiError(e.response?.data?.detail) || "Google sign-in failed.");
        setTimeout(() => navigate("/login", { replace: true }), 1800);
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Signing you in</div>
        <div className="font-display text-xl font-semibold mt-1 text-zinc-900">Finalizing your session…</div>
        {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
      </div>
    </div>
  );
}
