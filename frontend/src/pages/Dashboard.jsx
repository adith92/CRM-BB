import React, { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
import { Card } from "../components/ui/card";
import { Users, Briefcase, CheckSquare, TrendingUp, Target, DollarSign } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell
} from "recharts";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "../contexts/AuthContext";

const fmtMoney = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

const STAGE_LABELS = {
  prospecting: "Prospecting",
  qualification: "Qualification",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

function Stat({ label, value, icon: Icon, sub }) {
  return (
    <Card className="p-5 rounded-md border border-zinc-200 bg-white shadow-none" data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 font-medium">{label}</div>
        <Icon className="w-4 h-4 text-zinc-400" strokeWidth={1.6} />
      </div>
      <div className="mt-3 font-display text-3xl font-bold tracking-tight text-zinc-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/dashboard/stats");
      setStats(data);
    } catch (error) {
      console.error("Failed to load dashboard stats:", error);
      // Silent fail for background refresh
    }
  }, []);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("crm:refresh", h);
    return () => window.removeEventListener("crm:refresh", h);
  }, [load]);

  if (!stats) return <div className="p-6 text-sm text-zinc-500">Loading dashboard…</div>;

  const pipelineTotal = stats.pipeline.reduce((s, p) => s + p.total, 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Overview</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 mt-1">
            Welcome back, {user?.name?.split(" ")[0] || "there"}.
          </h1>
          <p className="text-sm text-zinc-600 mt-1">Here's what's happening at {user?.company_name}.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Leads" value={stats.leads_total} icon={Users} sub="Total in pipeline" />
        <Stat label="Opportunities" value={stats.opps_total} icon={Briefcase} sub={`${stats.won} won · ${stats.lost} lost`} />
        <Stat label="Conversion" value={`${stats.conversion_rate}%`} icon={Target} sub="Won / total opps" />
        <Stat label="Open Tasks" value={stats.activities_pending} icon={CheckSquare} sub="Pending activities" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 rounded-md border border-zinc-200 shadow-none" data-testid="widget-pipeline">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 font-medium">Sales pipeline</div>
              <div className="font-display text-lg font-semibold text-zinc-900 mt-0.5">{fmtMoney(pipelineTotal)} in play</div>
            </div>
            <TrendingUp className="w-4 h-4 text-zinc-400" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.pipeline.map(p => ({ ...p, label: STAGE_LABELS[p.stage] }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={{ stroke: "#e4e4e7" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e4e4e7", boxShadow: "none" }}
                formatter={(v) => fmtMoney(v)}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {stats.pipeline.map((p) => (
                  <Cell key={p.stage} fill={p.stage === "won" ? "#16a34a" : p.stage === "lost" ? "#dc2626" : "#18181b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 rounded-md border border-zinc-200 shadow-none" data-testid="widget-revenue">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 font-medium">Revenue</div>
              <div className="font-display text-lg font-semibold text-zinc-900 mt-0.5">Last 6 months</div>
            </div>
            <DollarSign className="w-4 h-4 text-zinc-400" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={stats.revenue}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#18181b" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#18181b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={{ stroke: "#e4e4e7" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e4e4e7" }} />
              <Area type="monotone" dataKey="revenue" stroke="#18181b" strokeWidth={1.5} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 rounded-md border border-zinc-200 shadow-none" data-testid="widget-activities">
          <div className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 font-medium mb-4">Recent activities</div>
          <div className="divide-y divide-zinc-100">
            {stats.recent_activities.length === 0 && (
              <div className="text-sm text-zinc-500 py-6 text-center">No activities yet.</div>
            )}
            {stats.recent_activities.map((a) => (
              <div key={a.activity_id} className="py-3 flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-zinc-900">{a.title}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    <span className="uppercase tracking-wide">{a.type}</span>
                    {a.related_to_name ? <> · {a.related_to_name}</> : null}
                    {" · "}{a.created_at ? formatDistanceToNow(new Date(a.created_at), { addSuffix: true }) : ""}
                  </div>
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-sm border ${
                  a.status === "done" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 rounded-md border border-zinc-200 shadow-none" data-testid="widget-conversion">
          <div className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 font-medium">Conversion rate</div>
          <div className="font-display text-5xl font-bold tracking-tight text-zinc-900 mt-4">{stats.conversion_rate}%</div>
          <div className="mt-2 text-xs text-zinc-500">Across {stats.opps_total} opportunities</div>
          <div className="mt-6 h-2 bg-zinc-100 rounded-sm overflow-hidden">
            <div className="h-full bg-zinc-900" style={{ width: `${Math.min(100, stats.conversion_rate)}%` }} />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-zinc-500">Won</div>
              <div className="font-display font-semibold text-zinc-900">{stats.won}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Lost</div>
              <div className="font-display font-semibold text-zinc-900">{stats.lost}</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
