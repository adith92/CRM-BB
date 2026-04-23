import React, { useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useI18n } from "../contexts/AppContext";
import { Zap, ArrowRight, Check, X, PlayCircle, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const STATUS = [
  { value: "pending", cls: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  { value: "assigned", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "on_trip", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "completed", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "cancelled", cls: "bg-red-50 text-red-700 border-red-200" },
];
const fmtIDR = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

export default function Trips() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const { data } = await api.get("/fleet/trips", { params: { limit: 200 } });
    setItems(data);
  }, []);
  
  useEffect(() => { load(); }, [load]);
  
  useEffect(() => {
    const h = () => load();
    window.addEventListener("crm:refresh", h);
    return () => window.removeEventListener("crm:refresh", h);
  }, [load]);

  const simulate = async () => {
    try {
      const { data } = await api.post("/fleet/simulate/incoming-trip");
      toast.success(`🚕 ${data.rider_name} → ${data.dropoff_name}`);
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || t("error")); }
  };

  const assign = async (id) => {
    try { await api.post(`/fleet/trips/${id}/assign`); toast.success("Assigned"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || t("error")); }
  };
  const setStatus = async (id, status) => {
    try { await api.patch(`/fleet/trips/${id}/status`, { status }); toast.success(t(status)); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || t("error")); }
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this trip?")) return;
    await api.delete(`/fleet/trips/${id}`); toast.success(t("deleted")); load();
  };

  const filtered = items.filter((tr) => {
    if (tab !== "all" && tr.status !== tab) return false;
    if (q) {
      const s = q.toLowerCase();
      return (tr.pickup_name || "").toLowerCase().includes(s) ||
             (tr.dropoff_name || "").toLowerCase().includes(s) ||
             (tr.rider_name || "").toLowerCase().includes(s) ||
             (tr.vehicle_plate || "").toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Fleet</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1">{t("trips_title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{items.length} trips · live ledger</p>
        </div>
        <div className="flex items-center gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rider / plate / place" className="w-64" data-testid="trips-search" />
          <Button onClick={simulate} data-testid="trips-simulate"><Zap className="w-4 h-4 mr-1.5" /> {t("simulate_incoming")}</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-transparent border-b border-border rounded-none p-0 h-9 w-full justify-start gap-4 overflow-x-auto">
          {["all", "pending", "assigned", "on_trip", "completed", "cancelled"].map((key) => (
            <TabsTrigger
              key={key} value={key}
              data-testid={`trips-tab-${key}`}
              className="data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none rounded-none px-1 py-2 text-muted-foreground capitalize whitespace-nowrap"
            >
              {key === "all" ? t("filter_all") : t(key)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card className="rounded-md border border-border bg-card shadow-none" data-testid="trips-list">
            {filtered.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-12">No trips here.</div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((tr) => {
                  const s = STATUS.find((x) => x.value === tr.status);
                  return (
                    <div key={tr.trip_id} className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center" data-testid={`trip-row-${tr.trip_id}`}>
                      <div className="md:col-span-5 flex items-center gap-3">
                        <div className={`w-1.5 h-8 rounded-sm ${tr.status === "completed" ? "bg-emerald-500" : tr.status === "on_trip" ? "bg-amber-500" : tr.status === "assigned" ? "bg-blue-500" : tr.status === "cancelled" ? "bg-red-500" : "bg-zinc-400"}`} />
                        <div>
                          <div className="font-medium flex items-center gap-2 flex-wrap">
                            <span>{tr.pickup_name}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>{tr.dropoff_name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">{tr.rider_name || "—"} · {tr.rider_phone || "—"}</div>
                        </div>
                      </div>
                      <div className="md:col-span-3 text-sm">
                        <div className="font-mono text-xs">{tr.vehicle_plate || "—"}</div>
                        <div className="text-xs text-muted-foreground">{tr.driver_name || "—"}</div>
                      </div>
                      <div className="md:col-span-2">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-sm border capitalize ${s?.cls}`}>{t(tr.status)}</span>
                        <div className="text-[11px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(tr.created_at), { addSuffix: true })}</div>
                      </div>
                      <div className="md:col-span-2 flex items-center md:justify-end gap-1.5">
                        <div className="font-display font-semibold tabular-nums mr-2">{fmtIDR(tr.fare)}</div>
                        {tr.status === "pending" && (
                          <button onClick={() => assign(tr.trip_id)} title={t("assign")} className="h-8 w-8 rounded-md bg-foreground text-background hover:opacity-80 inline-flex items-center justify-center" data-testid={`trip-assign-${tr.trip_id}`}>
                            <PlayCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(tr.status === "assigned" || tr.status === "on_trip") && (
                          <button onClick={() => setStatus(tr.trip_id, "on_trip")} title="Start" disabled={tr.status === "on_trip"} className="h-8 w-8 rounded-md border border-border hover:bg-accent inline-flex items-center justify-center disabled:opacity-30" data-testid={`trip-start-${tr.trip_id}`}>
                            <PlayCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(tr.status === "assigned" || tr.status === "on_trip") && (
                          <button onClick={() => setStatus(tr.trip_id, "completed")} title={t("complete")} className="h-8 w-8 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 inline-flex items-center justify-center" data-testid={`trip-complete-${tr.trip_id}`}>
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(tr.status === "pending" || tr.status === "assigned") && (
                          <button onClick={() => setStatus(tr.trip_id, "cancelled")} title={t("cancel")} className="h-8 w-8 rounded-md border border-border hover:bg-accent inline-flex items-center justify-center text-red-600" data-testid={`trip-cancel-${tr.trip_id}`}>
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => remove(tr.trip_id)} title="Delete" className="h-8 w-8 rounded-md hover:bg-accent inline-flex items-center justify-center text-red-600" data-testid={`trip-delete-${tr.trip_id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
