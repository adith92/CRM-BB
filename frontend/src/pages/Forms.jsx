import React, { useEffect, useState } from "react";
import { api, formatApiError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Plus, Copy, Trash2, ExternalLink, Code, Pencil, Eye, Inbox } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function Forms() {
  const [items, setItems] = useState([]);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const { data } = await api.get("/forms");
    setItems(data);
  };
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!window.confirm("Delete this form? Existing submissions stay in CRM.")) return;
    await api.delete(`/forms/${id}`);
    toast.success("Form deleted");
    load();
  };

  const toggleActive = async (f) => {
    await api.patch(`/forms/${f.form_id}`, { ...f, active: !f.active });
    load();
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Inbound</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 mt-1">Lead Capture Forms</h1>
          <p className="text-sm text-zinc-600 mt-1">Embed on any website. Submissions automatically become leads.</p>
        </div>
        <Button onClick={() => setCreating(true)} data-testid="new-form-btn">
          <Plus className="w-4 h-4 mr-1.5" /> New form
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="forms-grid">
        {items.length === 0 && (
          <div className="col-span-full text-center text-sm text-zinc-500 py-16 border border-dashed border-zinc-200 rounded-md">
            No forms yet. Create your first inbound form to start capturing leads.
          </div>
        )}
        {items.map((f) => (
          <Card key={f.form_id} className="p-5 rounded-md border border-zinc-200 shadow-none hover:border-zinc-300 transition-colors" data-testid={`form-card-${f.form_id}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-display font-semibold text-zinc-900 truncate">{f.title}</div>
                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${f.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-100 text-zinc-600 border-zinc-200"}`}>
                    {f.active ? "Live" : "Paused"}
                  </span>
                </div>
                {f.description && <div className="text-xs text-zinc-500 mt-1 line-clamp-2">{f.description}</div>}
              </div>
              <Switch checked={f.active} onCheckedChange={() => toggleActive(f)} data-testid={`form-toggle-${f.form_id}`} />
            </div>

            <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500">
              <span><span className="font-mono tabular-nums text-zinc-900 font-semibold">{f.submissions_count || 0}</span> submissions</span>
              <span>{f.fields?.length || 0} fields</span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setViewing(f)} data-testid={`form-embed-${f.form_id}`}>
                <Code className="w-3.5 h-3.5 mr-1.5" /> Embed
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(`/f/${f.form_id}`, "_blank")} data-testid={`form-preview-${f.form_id}`}>
                <Eye className="w-3.5 h-3.5 mr-1.5" /> Preview
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(f)} data-testid={`form-edit-${f.form_id}`}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
              </Button>
              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => remove(f.form_id)} data-testid={`form-delete-${f.form_id}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <FormEditDialog
        open={creating}
        onOpenChange={(o) => !o && setCreating(false)}
        onSaved={() => { setCreating(false); load(); }}
      />
      <FormEditDialog
        open={!!editing}
        initial={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />
      <FormEmbedDialog form={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function FormEditDialog({ open, onOpenChange, initial, onSaved }) {
  const [form, setForm] = useState({
    title: "", description: "", button_text: "Submit",
    success_message: "Thanks! We'll be in touch soon.",
    accent_color: "#18181B", active: true, fields: [],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) setForm({
      title: initial.title || "",
      description: initial.description || "",
      button_text: initial.button_text || "Submit",
      success_message: initial.success_message || "Thanks!",
      accent_color: initial.accent_color || "#18181B",
      active: initial.active ?? true,
      fields: initial.fields || [],
    });
    else setForm({
      title: "", description: "", button_text: "Submit",
      success_message: "Thanks! We'll be in touch soon.",
      accent_color: "#18181B", active: true, fields: [],
    });
  }, [initial, open]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (initial) {
        await api.patch(`/forms/${initial.form_id}`, form);
      } else {
        await api.post("/forms", form);
      }
      toast.success(initial ? "Form updated" : "Form created");
      onSaved();
    } catch (e2) {
      toast.error(formatApiError(e2.response?.data?.detail) || "Failed");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="form-edit-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">{initial ? "Edit form" : "New lead capture form"}</DialogTitle>
          <DialogDescription>Fields default to Name, Email, Phone, Company and Message.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div><Label className="text-xs">Title</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required data-testid="form-title" />
          </div>
          <div><Label className="text-xs">Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} data-testid="form-description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Button text</Label>
              <Input value={form.button_text} onChange={(e) => setForm((f) => ({ ...f, button_text: e.target.value }))} />
            </div>
            <div><Label className="text-xs">Accent color</Label>
              <Input type="color" value={form.accent_color} onChange={(e) => setForm((f) => ({ ...f, accent_color: e.target.value }))} className="h-9 p-1" />
            </div>
          </div>
          <div><Label className="text-xs">Success message</Label>
            <Input value={form.success_message} onChange={(e) => setForm((f) => ({ ...f, success_message: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving} data-testid="form-save">
              {saving ? "Saving…" : (initial ? "Save" : "Create form")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormEmbedDialog({ form, onClose }) {
  const [subs, setSubs] = useState([]);
  useEffect(() => {
    if (!form) return;
    api.get(`/forms/${form.form_id}/submissions`).then((r) => setSubs(r.data)).catch(() => {});
  }, [form]);

  if (!form) return null;
  const publicUrl = `${window.location.origin}/f/${form.form_id}`;
  const embedScript = `<script src="${BACKEND_URL}/api/public/forms/${form.form_id}/embed.js" async></script>`;
  const iframeCode = `<iframe src="${publicUrl}" style="border:0;width:100%;min-height:560px" loading="lazy" title="${form.title}"></iframe>`;

  const copy = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  return (
    <Dialog open={!!form} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl" data-testid="form-embed-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">{form.title}</DialogTitle>
          <DialogDescription>Embed this form or view its submissions.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="embed">
          <TabsList className="bg-transparent border-b border-zinc-200 rounded-none p-0 h-9 w-full justify-start gap-4">
            <TabsTrigger value="embed" className="data-[state=active]:border-b-2 data-[state=active]:border-zinc-900 data-[state=active]:text-zinc-900 data-[state=active]:shadow-none rounded-none px-1 py-2 text-zinc-500">Embed</TabsTrigger>
            <TabsTrigger value="submissions" className="data-[state=active]:border-b-2 data-[state=active]:border-zinc-900 data-[state=active]:text-zinc-900 data-[state=active]:shadow-none rounded-none px-1 py-2 text-zinc-500">
              Submissions <span className="ml-1.5 text-[10px] bg-zinc-100 border border-zinc-200 rounded-sm px-1">{subs.length}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="embed" className="pt-4 space-y-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.1em] text-zinc-500 mb-1.5">Public URL</div>
              <div className="flex items-center gap-2">
                <Input readOnly value={publicUrl} className="font-mono text-xs" data-testid="form-public-url" />
                <Button variant="outline" size="sm" onClick={() => copy(publicUrl, "URL")} data-testid="copy-url"><Copy className="w-3.5 h-3.5" /></Button>
                <Button variant="outline" size="sm" onClick={() => window.open(publicUrl, "_blank")}><ExternalLink className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.1em] text-zinc-500 mb-1.5">Embed script (recommended)</div>
              <div className="relative">
                <pre className="text-xs bg-zinc-50 border border-zinc-200 rounded-md p-3 overflow-x-auto font-mono">{embedScript}</pre>
                <Button variant="outline" size="sm" onClick={() => copy(embedScript, "Script")} className="absolute top-2 right-2" data-testid="copy-script"><Copy className="w-3.5 h-3.5" /></Button>
              </div>
              <p className="text-xs text-zinc-500 mt-1.5">Drop this in your site's HTML. UTM params on the page URL are automatically tracked.</p>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.1em] text-zinc-500 mb-1.5">Or iframe</div>
              <div className="relative">
                <pre className="text-xs bg-zinc-50 border border-zinc-200 rounded-md p-3 overflow-x-auto font-mono">{iframeCode}</pre>
                <Button variant="outline" size="sm" onClick={() => copy(iframeCode, "Iframe")} className="absolute top-2 right-2" data-testid="copy-iframe"><Copy className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="submissions" className="pt-4">
            {subs.length === 0 ? (
              <div className="text-center py-10 text-sm text-zinc-500 border border-dashed border-zinc-200 rounded-md">
                <Inbox className="w-6 h-6 mx-auto text-zinc-400 mb-2" />
                No submissions yet.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 border border-zinc-200 rounded-md">
                {subs.map((s) => (
                  <div key={s.submission_id} className="p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-zinc-900">{s.data?.name || s.data?.email || "Anonymous"}</div>
                      <div className="text-[11px] text-zinc-500">{formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}</div>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">{s.data?.email || "—"} · {s.data?.company_name || "—"}</div>
                    {s.utm_source && <div className="text-[11px] text-zinc-500 mt-1">UTM: {s.utm_source}{s.utm_campaign ? ` · ${s.utm_campaign}` : ""}</div>}
                    {s.data?.message && <div className="text-xs text-zinc-700 mt-1.5 italic">"{s.data.message}"</div>}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
