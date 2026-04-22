import React, { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { useI18n } from "../contexts/AppContext";
import { Plus, Search, Trash2, Pencil, Car } from "lucide-react";
import { toast } from "sonner";

const TYPES = ["Sedan", "SUV", "Taxi", "MPV", "Hatchback"];
const STATUS = [
  { value: "available", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "on_trip", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "offline", cls: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  { value: "maintenance", cls: "bg-red-50 text-red-700 border-red-200" },
];

export default function Vehicles() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const [v, d] = await Promise.all([api.get("/fleet/vehicles"), api.get("/fleet/drivers")]);
    setItems(v.data); setDrivers(d.data);
  };
  useEffect(() => { load(); }, []);

  const driverMap = useMemo(() => Object.fromEntries(drivers.map((d) => [d.driver_id, d])), [drivers]);

  const filtered = items.filter((v) => {
    if (!q) return true;
    const s = q.toLowerCase();
    const drv = driverMap[v.driver_id]?.name || "";
    return (v.plate || "").toLowerCase().includes(s) || drv.toLowerCase().includes(s) || (v.model || "").toLowerCase().includes(s);
  });

  const remove = async (id) => {
    if (!window.confirm("Delete this vehicle?")) return;
    await api.delete(`/fleet/vehicles/${id}`);
    toast.success(t("deleted")); load();
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Fleet</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1">{t("vehicles_title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{items.length} vehicles · editable roster</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Plate, model, driver…" className="pl-9 w-64" data-testid="vehicles-search" />
          </div>
          <Button onClick={() => setCreating(true)} data-testid="new-vehicle-btn"><Plus className="w-4 h-4 mr-1.5" /> {t("new_vehicle")}</Button>
        </div>
      </div>

      <Card className="rounded-md border border-border bg-card shadow-none overflow-hidden" data-testid="vehicles-table">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t("plate")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("model")}</TableHead>
              <TableHead>{t("type")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("driver")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                <Car className="w-5 h-5 mx-auto text-muted-foreground mb-1.5" /> No vehicles match.
              </TableCell></TableRow>
            )}
            {filtered.map((v) => {
              const s = STATUS.find((x) => x.value === v.status);
              const drv = driverMap[v.driver_id];
              return (
                <TableRow key={v.vehicle_id} data-testid={`vehicle-row-${v.vehicle_id}`}>
                  <TableCell className="font-mono text-xs">{v.plate}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{v.model || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{v.type}</TableCell>
                  <TableCell>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-sm border capitalize ${s?.cls}`}>{t(v.status)}</span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{drv ? drv.name : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => setEditing(v)} className="h-8 w-8 rounded-md hover:bg-accent inline-flex items-center justify-center" data-testid={`vehicle-edit-${v.vehicle_id}`}><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => remove(v.vehicle_id)} className="h-8 w-8 rounded-md hover:bg-accent inline-flex items-center justify-center text-red-600" data-testid={`vehicle-delete-${v.vehicle_id}`}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <VehicleDialog
        open={creating || !!editing}
        initial={editing}
        drivers={drivers}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        onSaved={() => { setCreating(false); setEditing(null); load(); }}
      />
    </div>
  );
}

function VehicleDialog({ open, onOpenChange, initial, drivers, onSaved }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ plate: "", model: "", type: "Sedan", status: "available", driver_id: "", maintenance_note: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) setForm({
      plate: initial.plate || "", model: initial.model || "", type: initial.type || "Sedan",
      status: initial.status || "available", driver_id: initial.driver_id || "",
      maintenance_note: initial.maintenance_note || "",
    });
    else setForm({ plate: "", model: "", type: "Sedan", status: "available", driver_id: "", maintenance_note: "" });
  }, [initial, open]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, driver_id: form.driver_id || null };
      if (initial) await api.patch(`/fleet/vehicles/${initial.vehicle_id}`, payload);
      else await api.post("/fleet/vehicles", payload);
      toast.success(t("saved"));
      onSaved();
    } catch (e2) {
      toast.error(formatApiError(e2.response?.data?.detail) || t("error"));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="font-display">{initial ? "Edit vehicle" : t("new_vehicle")}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">{t("plate")}</Label><Input value={form.plate} onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value }))} required data-testid="vehicle-plate" /></div>
            <div><Label className="text-xs">{t("type")}</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((tp) => <SelectItem key={tp} value={tp}>{tp}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label className="text-xs">{t("model")}</Label><Input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} placeholder="Toyota Avanza" /></div>
            <div><Label className="text-xs">{t("status")}</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{t(s.value)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">{t("driver")}</Label>
              <Select value={form.driver_id || "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, driver_id: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="__none__">None</SelectItem>
                  {drivers.map((d) => <SelectItem key={d.driver_id} value={d.driver_id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.status === "maintenance" && (
              <div className="col-span-2"><Label className="text-xs">Note</Label><Textarea rows={2} value={form.maintenance_note} onChange={(e) => setForm((f) => ({ ...f, maintenance_note: e.target.value }))} /></div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving} data-testid="vehicle-save">{saving ? "…" : t("saved")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
