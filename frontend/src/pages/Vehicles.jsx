import React, { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { useI18n } from "../contexts/AppContext";
import { Plus, Search, Trash2, Pencil, Car, User } from "lucide-react";
import { toast } from "sonner";

const TYPES = ["Sedan", "SUV", "Taxi", "MPV", "Hatchback"];
const STATUS = [
  { value: "available", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "on_trip", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "offline", cls: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  { value: "maintenance", cls: "bg-red-50 text-red-700 border-red-200" },
];

// Vehicle type to image mapping
const VEHICLE_IMAGES = {
  "Sedan": "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=300&fit=crop&auto=format",
  "SUV": "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=400&h=300&fit=crop&auto=format",
  "Taxi": "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=400&h=300&fit=crop&auto=format",
  "MPV": "https://images.unsplash.com/photo-1464219789935-c2d9d9aba644?w=400&h=300&fit=crop&auto=format",
  "Hatchback": "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400&h=300&fit=crop&auto=format",
};

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
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">
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

      {filtered.length === 0 ? (
        <Card className="rounded-xl border border-border bg-card shadow-sm p-12" data-testid="vehicles-empty">
          <div className="text-center text-muted-foreground">
            <Car className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-40" />
            <p className="text-sm">No vehicles match your search.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="vehicles-grid">
          {filtered.map((v) => {
            const s = STATUS.find((x) => x.value === v.status);
            const drv = driverMap[v.driver_id];
            const vehicleImage = VEHICLE_IMAGES[v.type] || VEHICLE_IMAGES["Sedan"];
            
            return (
              <Card 
                key={v.vehicle_id} 
                className="rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02] overflow-hidden group"
                data-testid={`vehicle-card-${v.vehicle_id}`}
              >
                {/* Vehicle Image */}
                <div className="relative h-40 bg-zinc-100 overflow-hidden">
                  <img 
                    src={vehicleImage} 
                    alt={v.type}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {/* Status Badge Overlay */}
                  <div className="absolute top-3 right-3">
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border capitalize backdrop-blur-sm ${s?.cls}`}>
                      {t(v.status)}
                    </span>
                  </div>
                  {/* Type Badge */}
                  <div className="absolute top-3 left-3">
                    <span className="text-[10px] font-medium px-2.5 py-1 rounded-full border bg-white/90 backdrop-blur-sm text-zinc-700 border-zinc-200">
                      {v.type}
                    </span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4 space-y-3">
                  {/* Plate Number */}
                  <div>
                    <h3 className="font-mono font-bold text-lg tracking-tight text-foreground">
                      {v.plate}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {v.model || "No model specified"}
                    </p>
                  </div>

                  {/* Driver Info */}
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {drv ? (
                        <span className="font-medium text-foreground">{drv.name}</span>
                      ) : (
                        <span className="italic">No driver assigned</span>
                      )}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <button 
                      onClick={() => setEditing(v)} 
                      className="flex-1 h-9 rounded-md hover:bg-accent inline-flex items-center justify-center text-sm font-medium transition-colors"
                      data-testid={`vehicle-edit-${v.vehicle_id}`}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1.5" />
                      Edit
                    </button>
                    <button 
                      onClick={() => remove(v.vehicle_id)} 
                      className="flex-1 h-9 rounded-md hover:bg-red-50 inline-flex items-center justify-center text-sm font-medium text-red-600 transition-colors"
                      data-testid={`vehicle-delete-${v.vehicle_id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

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
