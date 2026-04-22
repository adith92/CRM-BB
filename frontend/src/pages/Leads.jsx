import React, { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Trash2, Search, Pencil, ArrowRightCircle } from "lucide-react";
import { toast } from "sonner";

const STATUS = [
  { value: "new", label: "New", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "contacted", label: "Contacted", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "qualified", label: "Qualified", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "unqualified", label: "Unqualified", cls: "bg-zinc-100 text-zinc-700 border-zinc-200" },
];

export default function Leads() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState(null);

  const load = async () => {
    try {
      const params = {};
      if (q) params.q = q;
      if (status !== "all") params.status = status;
      const { data } = await api.get("/leads", { params });
      setItems(data);
    } catch {}
  };

  useEffect(() => { load(); }, [status]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener("crm:refresh", h);
    return () => window.removeEventListener("crm:refresh", h);
  }, []);

  const remove = async (id) => {
    if (!window.confirm("Delete this lead?")) return;
    await api.delete(`/leads/${id}`);
    toast.success("Lead deleted");
    load();
  };

  const convert = async (id) => {
    try {
      await api.post(`/leads/${id}/convert`);
      toast.success("Converted to contact + opportunity");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Failed");
    }
  };

  const statusCounts = useMemo(() => {
    const counts = {};
    items.forEach((l) => { counts[l.status] = (counts[l.status] || 0) + 1; });
    return counts;
  }, [items]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">CRM</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 mt-1">Leads</h1>
          <p className="text-sm text-zinc-600 mt-1">{items.length} leads · use Quick Create (⌘+ menu) to add new.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search leads…" className="pl-9 w-64" data-testid="leads-search" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44" data-testid="leads-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
          {STATUS.map((s) => (
            <span key={s.value} className={`px-2 py-0.5 rounded-sm border text-[11px] ${s.cls}`}>
              {s.label}: {statusCounts[s.value] || 0}
            </span>
          ))}
        </div>
      </div>

      <Card className="rounded-md border border-zinc-200 shadow-none overflow-hidden" data-testid="leads-table">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Company</TableHead>
              <TableHead className="hidden lg:table-cell">Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Score</TableHead>
              <TableHead className="hidden lg:table-cell">Owner</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-zinc-500 py-10">No leads yet.</TableCell></TableRow>
            )}
            {items.map((l) => {
              const s = STATUS.find((x) => x.value === l.status);
              return (
                <TableRow key={l.lead_id} data-testid={`lead-row-${l.lead_id}`}>
                  <TableCell className="font-medium text-zinc-900">{l.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-zinc-600">{l.company_name || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-zinc-600">{l.email || "—"}</TableCell>
                  <TableCell>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-sm border ${s?.cls}`}>{s?.label}</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-zinc-100 rounded-sm overflow-hidden">
                        <div className="h-full bg-zinc-900" style={{ width: `${l.score}%` }} />
                      </div>
                      <span className="text-xs text-zinc-600 tabular-nums">{l.score}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-zinc-600">{l.owner_name}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => setEditing(l)} className="h-8 w-8 rounded-md hover:bg-zinc-100 inline-flex items-center justify-center" data-testid={`lead-edit-${l.lead_id}`}>
                        <Pencil className="w-3.5 h-3.5 text-zinc-600" />
                      </button>
                      <button onClick={() => convert(l.lead_id)} title="Convert to opportunity" className="h-8 w-8 rounded-md hover:bg-zinc-100 inline-flex items-center justify-center" data-testid={`lead-convert-${l.lead_id}`}>
                        <ArrowRightCircle className="w-3.5 h-3.5 text-zinc-600" />
                      </button>
                      <button onClick={() => remove(l.lead_id)} className="h-8 w-8 rounded-md hover:bg-zinc-100 inline-flex items-center justify-center text-red-600" data-testid={`lead-delete-${l.lead_id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <EditLeadDialog lead={editing} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  );
}

function EditLeadDialog({ lead, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(lead ? { ...lead } : null); }, [lead]);

  if (!form) return null;
  const change = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name, email: form.email, phone: form.phone,
        company_name: form.company_name, source: form.source,
        status: form.status, score: Number(form.score || 0),
        notes: form.notes, tags: form.tags || [],
      };
      await api.patch(`/leads/${form.lead_id}`, payload);
      toast.success("Lead updated");
      onClose(); onSaved();
    } catch (e2) {
      toast.error(formatApiError(e2.response?.data?.detail) || "Failed");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-display">Edit lead</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Name</Label><Input value={form.name || ""} onChange={(e) => change("name")(e.target.value)} required /></div>
            <div><Label className="text-xs">Company</Label><Input value={form.company_name || ""} onChange={(e) => change("company_name")(e.target.value)} /></div>
            <div><Label className="text-xs">Email</Label><Input type="email" value={form.email || ""} onChange={(e) => change("email")(e.target.value)} /></div>
            <div><Label className="text-xs">Phone</Label><Input value={form.phone || ""} onChange={(e) => change("phone")(e.target.value)} /></div>
            <div><Label className="text-xs">Source</Label><Input value={form.source || ""} onChange={(e) => change("source")(e.target.value)} /></div>
            <div><Label className="text-xs">Score</Label><Input type="number" min="0" max="100" value={form.score ?? 0} onChange={(e) => change("score")(e.target.value)} /></div>
            <div className="col-span-2">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => change("status")(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes || ""} onChange={(e) => change("notes")(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} data-testid="lead-save">{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
