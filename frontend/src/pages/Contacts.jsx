import React, { useEffect, useState } from "react";
import { api, formatApiError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Search, Building2, User, Trash2, Pencil, Mail, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";

export default function Contacts() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const { data } = await api.get("/contacts", { params: q ? { q } : {} });
    setItems(data);
  };

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener("crm:refresh", h);
    return () => window.removeEventListener("crm:refresh", h);
  }, []);

  const remove = async (id) => {
    if (!window.confirm("Delete this contact?")) return;
    await api.delete(`/contacts/${id}`);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Relationships</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 mt-1">Contacts</h1>
          <p className="text-sm text-zinc-600 mt-1">{items.length} total — people and companies.</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts…" className="pl-9 w-64" data-testid="contacts-search" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="contacts-grid">
        {items.length === 0 && (
          <div className="col-span-full text-center text-sm text-zinc-500 py-16 border border-dashed border-zinc-200 rounded-md">
            No contacts yet. Use Quick Create to add one.
          </div>
        )}
        {items.map((c) => {
          const initials = (c.name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
          const isCompany = c.type === "company";
          return (
            <Card key={c.contact_id} className="p-5 rounded-md border border-zinc-200 shadow-none hover:border-zinc-300 transition-colors" data-testid={`contact-card-${c.contact_id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 rounded-md">
                    <AvatarFallback className="rounded-md bg-zinc-900 text-white text-sm">
                      {isCompany ? <Building2 className="w-4 h-4" /> : initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-zinc-900 leading-tight">{c.name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5">
                      {isCompany ? <Building2 className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {isCompany ? "Company" : c.title || "Person"}
                      {c.company_name && !isCompany && <> · {c.company_name}</>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center">
                  <button onClick={() => setEditing(c)} className="h-8 w-8 rounded-md hover:bg-zinc-100 inline-flex items-center justify-center" data-testid={`contact-edit-${c.contact_id}`}>
                    <Pencil className="w-3.5 h-3.5 text-zinc-600" />
                  </button>
                  <button onClick={() => remove(c.contact_id)} className="h-8 w-8 rounded-md hover:bg-zinc-100 inline-flex items-center justify-center text-red-600" data-testid={`contact-delete-${c.contact_id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-4 space-y-1.5 text-xs text-zinc-600">
                {c.email && <div className="flex items-center gap-2"><Mail className="w-3 h-3" /> {c.email}</div>}
                {c.phone && <div className="flex items-center gap-2"><Phone className="w-3 h-3" /> {c.phone}</div>}
              </div>
              {c.tags?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {c.tags.map((t) => (
                    <span key={t} className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-zinc-100 border border-zinc-200 text-zinc-600">{t}</span>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <EditDialog contact={editing} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  );
}

function EditDialog({ contact, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(contact ? { ...contact } : null); }, [contact]);
  if (!form) return null;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name, type: form.type || "person",
        email: form.email, phone: form.phone,
        company_name: form.company_name, title: form.title,
        tags: form.tags || [], notes: form.notes,
      };
      await api.patch(`/contacts/${form.contact_id}`, payload);
      toast.success("Contact updated");
      onClose(); onSaved();
    } catch (e2) {
      toast.error(formatApiError(e2.response?.data?.detail) || "Failed");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={!!contact} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-display">Edit contact</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Name</Label><Input value={form.name || ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
            <div><Label className="text-xs">Type</Label>
              <Select value={form.type || "person"} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">Person</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Email</Label><Input type="email" value={form.email || ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
            <div><Label className="text-xs">Phone</Label><Input value={form.phone || ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
            <div><Label className="text-xs">Company</Label><Input value={form.company_name || ""} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} /></div>
            <div><Label className="text-xs">Title</Label><Input value={form.title || ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} data-testid="contact-save">{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
