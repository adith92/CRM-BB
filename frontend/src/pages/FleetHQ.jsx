import React, { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useI18n } from "../contexts/AppContext";
import { useLiveVehicles, FleetMap } from "../components/FleetMap";
import {
  Car, UserCheck, Route as RouteIcon, Coins, Zap, TrendingUp, Radar, ArrowUpRight, Sparkles
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, AreaChart, Area, Cell
} from "recharts";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

const fmtIDR = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

function KPI({ icon: Icon, label, value, accent = "text-foreground", sub, testid }) {
  return (
    <Card className="p-5 rounded-md border border-border bg-card/70 backdrop-blur-sm shadow-none relative overflow-hidden group" data-testid={testid}>
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br from-foreground/5 to-transparent pointer-events-none" />
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">{label}</div>
        <Icon className={`w-4 h-4 ${accent}`} strokeWidth={1.6} />
      </div>
      <div className={`mt-3 font-display text-4xl font-bold tracking-tight ${accent}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

export default function FleetHQ() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { vehicles, trips } = useLiveVehicles();
  const [stats, setStats] = useState(null);
  const [simLoading, setSimLoading] = useState(false);

  const load = async () => {
    try { const { data } = await api.get("/fleet/stats"); setStats(data); } catch {}
  };
  useEffect(() => {
    load();
    const i = setInterval(load, 8000);
    return () => clearInterval(i);
  }, []);

  const simulate = async () => {
    setSimLoading(true);
    try {
      const { data } = await api.post("/fleet/simulate/incoming-trip");
      toast.success(`🚕 ${data.rider_name} → ${data.dropoff_name}`);
      load();
      window.dispatchEvent(new CustomEvent("crm:refresh"));
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || t("error"));
    } finally { setSimLoading(false); }
  };

  const statusCounts = useMemo(() => {
    const c = { available: 0, on_trip: 0, offline: 0, maintenance: 0 };
    vehicles.forEach((v) => { c[v.status] = (c[v.status] || 0) + 1; });
    return c;
  }, [vehicles]);

  const statusBars = [
    { key: "available", label: t("available"), value: statusCounts.available, color: "#10b981" },
    { key: "on_trip", label: t("on_trip"), value: statusCounts.on_trip, color: "#f59e0b" },
    { key: "offline", label: t("offline"), value: statusCounts.offline, color: "#71717a" },
    { key: "maintenance", label: t("maintenance"), value: statusCounts.maintenance, color: "#e11d48" },
  ];

  const recentTrips = trips.slice(0, 8);

  if (!stats) return <div className="p-6 text-sm text-muted-foreground">Loading fleet HQ…</div>;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1500px] mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-[11px] uppercase tracking-[0.2em] text-emerald-600 font-semibold">{t("live")}</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-1" data-testid="fleet-hq-title">{t("fleet_hq")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("fleet_subtitle")}</p>
        </div>
        <Button onClick={simulate} disabled={simLoading} data-testid="simulate-btn">
          <Zap className="w-4 h-4 mr-1.5" /> {t("simulate_incoming")}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={Car} label={t("kpi_active_vehicles")} value={`${stats.vehicles.available + stats.vehicles.on_trip}`} sub={`${stats.vehicles.total} total · ${stats.vehicles.on_trip} ${t("on_trip").toLowerCase()}`} testid="kpi-vehicles" accent="text-emerald-600" />
        <KPI icon={UserCheck} label={t("kpi_on_duty_drivers")} value={stats.drivers.on_duty} sub={`${stats.drivers.total} total drivers`} testid="kpi-drivers" accent="text-blue-600" />
        <KPI icon={RouteIcon} label={t("kpi_trips_today")} value={stats.trips.today} sub={`${stats.trips.active} active · ${stats.trips.completed_today} completed`} testid="kpi-trips" accent="text-amber-600" />
        <KPI icon={Coins} label={t("kpi_revenue_today")} value={fmtIDR(stats.revenue_today)} sub="Completed trips" testid="kpi-revenue" accent="text-foreground" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 rounded-md border border-border bg-card shadow-none" data-testid="widget-trips-per-hour">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium">{t("trips_per_hour")}</div>
              <div className="font-display text-lg font-semibold mt-0.5">{stats.trips.today} trips today</div>
            </div>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={stats.trips_per_hour}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#18181b" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#18181b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-muted opacity-30" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "currentColor" }} className="text-muted-foreground" axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "currentColor" }} className="text-muted-foreground" axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }} />
              <Area type="monotone" dataKey="trips" stroke="#18181b" strokeWidth={1.5} fill="url(#g1)" className="stroke-foreground" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 rounded-md border border-border bg-card shadow-none" data-testid="widget-status-breakdown">
          <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium">{t("vehicle_breakdown")}</div>
          <div className="font-display text-lg font-semibold mt-0.5">{stats.vehicles.total} vehicles</div>
          <div className="mt-5 space-y-3">
            {statusBars.map((s) => {
              const pct = stats.vehicles.total ? (s.value / stats.vehicles.total) * 100 : 0;
              return (
                <div key={s.key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} /> {s.label}</span>
                    <span className="tabular-nums font-medium">{s.value}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-sm overflow-hidden">
                    <div className="h-full rounded-sm transition-all" style={{ width: `${pct}%`, background: s.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 rounded-md border border-border bg-card shadow-none overflow-hidden" data-testid="widget-mini-map">
          <div className="flex items-center justify-between p-5 pb-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium">{t("live_map_preview")}</div>
              <div className="font-display text-lg font-semibold mt-0.5 flex items-center gap-2">
                {vehicles.length} vehicles
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border border-emerald-200 bg-emerald-50 text-emerald-700">{t("live")}</span>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/map")} data-testid="open-full-map">
              {t("open_full_map")} <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
          <div className="h-[360px] px-5 pb-5">
            <FleetMap vehicles={vehicles} interactive={false} height="100%" />
          </div>
        </Card>

        <Card className="rounded-md border border-border bg-card shadow-none" data-testid="widget-recent-trips">
          <div className="p-5 pb-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium">{t("recent_trips")}</div>
              <div className="font-display text-lg font-semibold mt-0.5">{recentTrips.length}</div>
            </div>
            <Sparkles className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border max-h-[360px] overflow-y-auto">
            {recentTrips.map((tr) => (
              <div key={tr.trip_id} className="p-4 flex items-start gap-3 text-sm">
                <div className={`mt-1 w-1.5 h-1.5 rounded-full ${tr.status === "completed" ? "bg-emerald-500" : tr.status === "on_trip" ? "bg-amber-500" : tr.status === "assigned" ? "bg-blue-500" : tr.status === "cancelled" ? "bg-red-500" : "bg-zinc-400"}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{tr.pickup_name} → {tr.dropoff_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{tr.rider_name || "—"} · {tr.vehicle_plate || "—"}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(tr.created_at), { addSuffix: true })}</div>
                </div>
                <div className="text-right">
                  <div className="font-display font-semibold tabular-nums">{fmtIDR(tr.fare)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t(tr.status)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5 rounded-md border border-border bg-card shadow-none" data-testid="widget-revenue-7d">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium">{t("revenue_7d")}</div>
            <div className="font-display text-lg font-semibold mt-0.5">{fmtIDR(stats.revenue_7d.reduce((s, x) => s + x.revenue, 0))}</div>
          </div>
          <Radar className="w-4 h-4 text-muted-foreground" />
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={stats.revenue_7d}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-muted opacity-30" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "currentColor" }} className="text-muted-foreground" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "currentColor" }} className="text-muted-foreground" axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(v) => fmtIDR(v)} contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }} />
            <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: "#10b981" }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
