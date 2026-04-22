import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Hexagon, Check } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const PUBLIC_API = `${BACKEND_URL}/api/public`;

export default function PublicForm() {
  const { formId } = useParams();
  const [form, setForm] = useState(null);
  const [values, setValues] = useState({});
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [err, setErr] = useState("");

  useEffect(() => {
    axios.get(`${PUBLIC_API}/forms/${formId}`)
      .then((r) => setForm(r.data))
      .catch((e) => setErr(e.response?.status === 404 ? "This form is no longer available." : "Unable to load form."));
  }, [formId]);

  const submit = async (e) => {
    e.preventDefault();
    setStatus({ state: "submitting", message: "" });
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const payload = {
        data: values,
        utm_source: urlParams.get("utm_source"),
        utm_medium: urlParams.get("utm_medium"),
        utm_campaign: urlParams.get("utm_campaign"),
        page_url: document.referrer || window.location.href,
      };
      const { data } = await axios.post(`${PUBLIC_API}/forms/${formId}/submit`, payload);
      setStatus({ state: "success", message: data.message || "Thanks!" });
    } catch (e2) {
      const d = e2.response?.data?.detail;
      const msg = typeof d === "string" ? d : "Something went wrong. Please try again.";
      setStatus({ state: "error", message: msg });
    }
  };

  if (err) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-white">
      <div className="text-center max-w-sm">
        <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Unavailable</div>
        <div className="font-display text-xl font-semibold mt-1 text-zinc-900">{err}</div>
      </div>
    </div>
  );
  if (!form) return <div className="min-h-screen flex items-center justify-center text-sm text-zinc-500">Loading…</div>;

  const accent = form.accent_color || "#18181B";

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-8 flex items-start md:items-center justify-center">
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-md p-6 md:p-8 shadow-sm" data-testid="public-form-card">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-md text-white flex items-center justify-center" style={{ backgroundColor: accent }}>
            <Hexagon className="w-3.5 h-3.5" strokeWidth={1.8} />
          </div>
          <span className="text-xs text-zinc-500">{form.company_name || "Powered by Relay"}</span>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900" data-testid="public-form-title">{form.title}</h1>
        {form.description && <p className="text-sm text-zinc-600 mt-2 leading-relaxed">{form.description}</p>}

        {status.state === "success" ? (
          <div className="mt-6 p-5 rounded-md border border-emerald-200 bg-emerald-50 text-center" data-testid="public-form-success">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <Check className="w-5 h-5" />
            </div>
            <div className="mt-3 font-display font-semibold text-emerald-900">{status.message}</div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {/* Honeypot (hidden) */}
            <div className="hidden" aria-hidden="true">
              <input type="text" name="website" tabIndex={-1} autoComplete="off"
                onChange={(e) => setValues((v) => ({ ...v, website: e.target.value }))} />
            </div>
            {form.fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-700">
                  {f.label}{f.required ? <span className="text-red-500"> *</span> : null}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    rows={4}
                    required={f.required}
                    placeholder={f.placeholder}
                    value={values[f.key] || ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    data-testid={`pub-field-${f.key}`}
                  />
                ) : (
                  <input
                    type={f.type || "text"}
                    required={f.required}
                    placeholder={f.placeholder}
                    value={values[f.key] || ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    className="w-full h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    data-testid={`pub-field-${f.key}`}
                  />
                )}
              </div>
            ))}
            {status.state === "error" && <div className="text-sm text-red-600" data-testid="public-form-error">{status.message}</div>}
            <button
              type="submit"
              disabled={status.state === "submitting"}
              className="w-full h-10 rounded-md text-white text-sm font-medium disabled:opacity-60 transition-opacity"
              style={{ backgroundColor: accent }}
              data-testid="public-form-submit"
            >
              {status.state === "submitting" ? "Sending…" : form.button_text}
            </button>
            <p className="text-[11px] text-zinc-400 text-center">Powered by Relay CRM</p>
          </form>
        )}
      </div>
    </div>
  );
}
