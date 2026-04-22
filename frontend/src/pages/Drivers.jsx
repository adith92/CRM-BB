import React, { useEffect, useState } from "react";
import { api, formatApiError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { useI18n } from "../contexts/AppContext";
import { Plus, Search, Trash2, Pencil, Star, Phone } from "lucide-react";
import { toast } from "sonner";

const STATUS = [
  { value: "on_duty", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "off_duty", cls: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  { value: "break", cls: "bg-amber-50 text-amber-700 border-amber-200" },
];

export default function Drivers() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const { data } = await api.get("/fleet/drivers");
    setItems(data);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter((d) => !q || (d.name || "").toLowerCase().includes(q.toLowerCase()) || (d.phone || "").includes(q));

  const remove = async (id) => {
    if (!window.confirm("Delete this driver?")) return;
    await api.delete(`/fleet/drivers/${id}`); toast.success(t("deleted")); load();
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Fleet</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1">{t("drivers_title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{items.length} drivers · editable roster</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or phone" className="pl-9 w-64" data-testid="drivers-search" />
          </div>
          <Button onClick={() => setCreating(true)} data-testid="new-driver-btn"><Plus className="w-4 h-4 mr-1.5" /> {t("new_driver")}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="drivers-grid">
        {filtered.map((d) => {
          const s = STATUS.find((x) => x.value === d.status);
          const initials = d.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
          return (
            <Card key={d.driver_id} className="p-4 rounded-md border border-border bg-card shadow-none hover:border-foreground/20 transition-colors" data-testid={`driver-card-${d.driver_id}`}>
              <div className="flex items-start gap-3">
                <Avatar className="w-10 h-10 rounded-md">
                  <AvatarFallback className="rounded-md bg-foreground text-background text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate">{d.name}</div>
                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${s?.cls}`}>{t(d.status)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <Phone className="w-3 h-3" /> {d.phone || "—"}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-amber-600"><Star className="w-3 h-3 fill-amber-500" /> <span className="tabular-nums">{d.rating?.toFixed?.(2) || d.rating}</span></span>
                    <span className="text-muted-foreground tabular-nums">{d.total_trips || 0} trips</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => setEditing(d)} className="h-7 w-7 rounded-md hover:bg-accent inline-flex items-center justify-center" data-testid={`driver-edit-${d.driver_id}`}><Pencil className="w-3 h-3" /></button>
                  <button onClick={() => remove(d.driver_id)} className="h-7 w-7 rounded-md hover:bg-accent inline-flex items-center justify-center text-red-600" data-testid={`driver-delete-${d.driver_id}`}><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <DriverDialog
        open={creating || !!editing}
        initial={editing}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        onSaved={() => { setCreating(false); setEditing(null); load(); }}
      />
    </div>
  );
}

function DriverDialog({ open, onOpenChange, initial, onSaved }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ name: "", phone: "", status: "on_duty", rating: 4.8, license_no: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) setForm({
      name: initial.name || "", phone: initial.phone || "",
      status: initial.status || "on_duty", rating: initial.rating ?? 4.8,
      license_no: initial.license_no || "",
    });
    else setForm({ name: "", phone: "", status: "on_duty", rating: 4.8, license_no: "" });
  }, [initial, open]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, rating: Number(form.rating) };
      if (initial) await api.patch(`/fleet/drivers/${initial.driver_id}`, payload);
      else await api.post("/fleet/drivers", payload);
      toast.success(t("saved"));
      onSaved();
    } catch (e2) {
      toast.error(formatApiError(e2.response?.data?.detail) || t("error"));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="font-display">{initial ? "Edit driver" : t("new_driver")}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label className="text-xs">{t("name")}</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required data-testid="driver-name" /></div>
            <div><Label className="text-xs">{t("phone")}</Label><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
            <div><Label className="text-xs">{t("status")}</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{t(s.value)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">{t("rating")}</Label><Input type="number" min="1" max="5" step="0.01" value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))} /></div>
            <div><Label className="text-xs">License #</Label><Input value={form.license_no} onChange={(e) => setForm((f) => ({ ...f, license_no: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving} data-testid="driver-save">{saving ? "…" : t("saved")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
