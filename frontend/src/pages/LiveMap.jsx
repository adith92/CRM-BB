import React, { useMemo, useState } from "react";
import { FleetMap, useLiveVehicles } from "../components/FleetMap";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useI18n } from "../contexts/AppContext";
import { Search, Zap } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { toast } from "sonner";

const STATUS = [
  { key: "all", label: "All", color: "#18181b" },
  { key: "available", color: "#10b981" },
  { key: "on_trip", color: "#f59e0b" },
  { key: "offline", color: "#71717a" },
  { key: "maintenance", color: "#e11d48" },
];

export default function LiveMap() {
  const { t } = useI18n();
  const { vehicles } = useLiveVehicles();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return vehicles.filter((v) => {
      if (filter !== "all" && v.status !== filter) return false;
      if (q) {
        const s = q.toLowerCase();
        return (v.plate || "").toLowerCase().includes(s) || (v.driver_name || "").toLowerCase().includes(s);
      }
      return true;
    });
  }, [vehicles, filter, q]);

  const counts = useMemo(() => {
    const c = { all: vehicles.length, available: 0, on_trip: 0, offline: 0, maintenance: 0 };
    vehicles.forEach((v) => { c[v.status] = (c[v.status] || 0) + 1; });
    return c;
  }, [vehicles]);

  const simulate = async () => {
    try {
      const { data } = await api.post("/fleet/simulate/incoming-trip");
      toast.success(`🚕 ${data.rider_name} → ${data.dropoff_name}`);
      window.dispatchEvent(new CustomEvent("crm:refresh"));
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || t("error"));
    }
  };

  return (
    <div className="p-0 md:p-4 lg:p-6 relative" data-testid="live-map-page">
      <div className="flex items-end justify-between gap-4 px-4 pt-4 md:p-0 md:mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-[11px] uppercase tracking-[0.2em] text-emerald-600 font-semibold">{t("live")}</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1">{t("map_title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("map_sub")}</p>
        </div>
        <Button onClick={simulate} data-testid="map-simulate">
          <Zap className="w-4 h-4 mr-1.5" /> {t("simulate_incoming")}
        </Button>
      </div>

      <div className="relative mt-4 md:mt-0">
        <div className="h-[calc(100vh-14rem)] md:h-[calc(100vh-11rem)] rounded-md overflow-hidden border border-border">
          <FleetMap vehicles={filtered} height="100%" />
        </div>

        {/* Floating control panel */}
        <Card className="glass absolute top-3 left-3 md:top-4 md:left-4 z-[1000] w-[280px] p-3 rounded-md border border-border shadow-xl" data-testid="map-controls">
          <div className="relative mb-2.5">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Plate / driver…" className="pl-8 h-8 text-sm" data-testid="map-search" />
          </div>
          <div className="grid grid-cols-5 gap-1">
            {STATUS.map((s) => {
              const active = filter === s.key;
              const label = s.key === "all" ? t("filter_all") : t(s.key);
              return (
                <button
                  key={s.key}
                  onClick={() => setFilter(s.key)}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-sm border text-[10px] font-medium transition-colors ${active ? "bg-foreground text-background border-foreground" : "border-border hover:bg-accent"}`}
                  data-testid={`map-filter-${s.key}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                  <span className="tabular-nums font-display font-bold text-sm">{counts[s.key]}</span>
                  <span className="text-[9px] uppercase tracking-wider">{label}</span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
