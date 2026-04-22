import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Hexagon } from "lucide-react";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { useAuth } from "../contexts/AuthContext";
import { formatApiError } from "../lib/api";

export default function Signup() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ company_name: "", name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const change = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      await register(form);
      navigate("/dashboard");
    } catch (e2) {
      setErr(formatApiError(e2.response?.data?.detail) || "Signup failed");
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
    <div className="min-h-screen flex items-center justify-center p-6 md:p-10 auth-grid bg-white">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-md bg-zinc-900 text-white flex items-center justify-center">
            <Hexagon className="w-4 h-4" strokeWidth={1.8} />
          </div>
          <span className="font-display font-bold tracking-tight">Relay CRM</span>
        </div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Create workspace</div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">Start your company on Relay</h2>
        <p className="text-sm text-zinc-600 mt-2">You'll be the admin of your new workspace.</p>

        <button
          onClick={onGoogle}
          data-testid="google-signup-btn"
          className="mt-6 w-full h-10 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 inline-flex items-center justify-center gap-2 text-sm font-medium text-zinc-800"
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

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-700">Company name</Label>
            <Input value={form.company_name} onChange={change("company_name")} required data-testid="signup-company" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-700">Your name</Label>
            <Input value={form.name} onChange={change("name")} required data-testid="signup-name" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-700">Work email</Label>
            <Input type="email" value={form.email} onChange={change("email")} required data-testid="signup-email" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-700">Password</Label>
            <Input type="password" value={form.password} onChange={change("password")} required minLength={6} data-testid="signup-password" />
          </div>
          {err && <div className="text-sm text-red-600" data-testid="signup-error">{err}</div>}
          <Button type="submit" className="w-full h-10" disabled={loading} data-testid="signup-submit">
            {loading ? "Creating…" : "Create workspace"}
          </Button>
        </form>

        <p className="text-sm text-zinc-600 mt-6 text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-zinc-900 font-medium underline-offset-4 hover:underline" data-testid="go-login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
