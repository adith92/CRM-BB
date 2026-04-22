import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Hexagon } from "lucide-react";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { useAuth } from "../contexts/AuthContext";
import { formatApiError } from "../lib/api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@acme.com");
  const [password, setPassword] = useState("admin123");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (e2) {
      setErr(formatApiError(e2.response?.data?.detail) || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <div className="hidden lg:flex relative overflow-hidden bg-zinc-950 text-zinc-50">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "url(https://images.pexels.com/photos/35173078/pexels-photo-35173078.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-black/40" />
        <div className="relative z-10 p-12 flex flex-col justify-between w-full">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-white text-zinc-950 flex items-center justify-center">
              <Hexagon className="w-4 h-4" strokeWidth={1.8} />
            </div>
            <span className="font-display font-bold tracking-tight">Relay CRM</span>
          </div>
          <div className="max-w-md">
            <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 mb-3">Enterprise CRM, minimalist by design</div>
            <h1 className="font-display text-4xl font-bold tracking-tight leading-tight">
              The quietly powerful CRM for teams that ship.
            </h1>
            <p className="mt-4 text-zinc-400 leading-relaxed">
              Pipelines, leads, activities — organized with clarity. Multi-tenant, role-based, and ready for your workflow.
            </p>
          </div>
          <div className="text-xs text-zinc-500">© Relay CRM</div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-10 auth-grid">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-md bg-zinc-900 text-white flex items-center justify-center">
              <Hexagon className="w-4 h-4" strokeWidth={1.8} />
            </div>
            <span className="font-display font-bold tracking-tight">Relay CRM</span>
          </div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Welcome back</div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">Sign in to your workspace</h2>
          <p className="text-sm text-zinc-600 mt-2">Use your company email to continue.</p>

          <button
            onClick={onGoogle}
            data-testid="google-login-btn"
            className="mt-7 w-full h-10 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 inline-flex items-center justify-center gap-2 text-sm font-medium text-zinc-800 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.5 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C33.8 6.1 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3 0 5.7 1.1 7.8 2.9l5.7-5.7C33.8 6.1 29.2 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.1 0 9.8-2 13.3-5.2l-6.2-5.2C29.3 34.8 26.8 36 24 36c-5.3 0-9.7-3.5-11.3-8.4l-6.5 5C9.5 39.5 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2C40.9 35.8 44 30.4 44 24c0-1.2-.1-2.3-.4-3.5z"/>
            </svg>
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.15em] text-zinc-400">
            <div className="flex-1 h-px bg-zinc-200" /> or <div className="flex-1 h-px bg-zinc-200" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-zinc-700">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="login-email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-zinc-700">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="login-password" />
            </div>
            {err && <div className="text-sm text-red-600" data-testid="login-error">{err}</div>}
            <Button type="submit" className="w-full h-10" disabled={loading} data-testid="login-submit">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="text-sm text-zinc-600 mt-6 text-center">
            No account yet?{" "}
            <Link to="/signup" className="text-zinc-900 font-medium underline-offset-4 hover:underline" data-testid="go-signup">
              Start a workspace
            </Link>
          </p>

          <div className="mt-8 text-xs text-zinc-400 text-center">
            Demo: <span className="font-mono">admin@acme.com / admin123</span>
          </div>
        </div>
      </div>
    </div>
  );
}
