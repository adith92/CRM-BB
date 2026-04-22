import React, { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "../lib/api";
import { Card } from "../components/ui/card";
import { MoreHorizontal, Trash2, Pencil, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu";

const STAGES = [
  { value: "prospecting", label: "Prospecting" },
  { value: "qualification", label: "Qualification" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

export default function Opportunities() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/opportunities");
      setItems(data);
    } catch {}
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const h = () => load();
    window.addEventListener("crm:refresh", h);
    return () => window.removeEventListener("crm:refresh", h);
  }, []);

  const byStage = useMemo(() => {
    const map = Object.fromEntries(STAGES.map((s) => [s.value, []]));
    items.forEach((o) => { if (map[o.stage]) map[o.stage].push(o); });
    return map;
  }, [items]);

  const onDragStart = (id) => setDragId(id);
  const onDragEnd = () => { setDragId(null); setOverStage(null); };
  const onDragOver = (stage) => (e) => { e.preventDefault(); setOverStage(stage); };
  const onDrop = (stage) => async (e) => {
    e.preventDefault();
    setOverStage(null);
    if (!dragId) return;
    const opp = items.find((o) => o.opp_id === dragId);
    setDragId(null);
    if (!opp || opp.stage === stage) return;
    // optimistic
    setItems((prev) => prev.map((o) => o.opp_id === opp.opp_id ? { ...o, stage } : o));
    try {
      await api.patch(`/opportunities/${opp.opp_id}/stage`, { stage });
      toast.success(`Moved to ${STAGES.find(s => s.value === stage)?.label}`);
    } catch (e2) {
      toast.error(formatApiError(e2.response?.data?.detail) || "Failed");
      load();
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this opportunity?")) return;
    await api.delete(`/opportunities/${id}`);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-full">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">CRM</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 mt-1">Pipeline</h1>
          <p className="text-sm text-zinc-600 mt-1">Drag cards across stages to update. {items.length} opportunities.</p>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4" data-testid="pipeline-kanban">
        {STAGES.map((s) => {
          const list = byStage[s.value] || [];
          const total = list.reduce((sum, o) => sum + (o.amount || 0), 0);
          const isOver = overStage === s.value;
          return (
            <div
              key={s.value}
              onDragOver={onDragOver(s.value)}
              onDrop={onDrop(s.value)}
              onDragLeave={() => setOverStage(null)}
              className={`w-80 flex-shrink-0 bg-zinc-50 rounded-md p-3 border border-zinc-200 flex flex-col gap-3 kanban-col ${isOver ? "drag-over" : ""}`}
              data-testid={`kanban-col-${s.value}`}
            >
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${s.value === "won" ? "bg-emerald-500" : s.value === "lost" ? "bg-red-500" : "bg-zinc-900"}`} />
                  <div className="text-sm font-semibold text-zinc-900">{s.label}</div>
                  <span className="text-xs text-zinc-500 tabular-nums">{list.length}</span>
                </div>
                <div className="text-[11px] text-zinc-500 font-mono tabular-nums">{fmt(total)}</div>
              </div>
              <div className="flex flex-col gap-2 min-h-[60px]">
                {list.map((o) => (
                  <Card
                    key={o.opp_id}
                    draggable
                    onDragStart={() => onDragStart(o.opp_id)}
                    onDragEnd={onDragEnd}
                    className={`kanban-card bg-white p-3 rounded-md border border-zinc-200 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all cursor-grab active:cursor-grabbing ${dragId === o.opp_id ? "dragging" : ""}`}
                    data-testid={`opp-card-${o.opp_id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium text-zinc-900 leading-snug flex-1">{o.title}</div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-zinc-400 hover:text-zinc-900 p-0.5 rounded-sm" data-testid={`opp-menu-${o.opp_id}`}>
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem onClick={() => setEditing(o)}><Pencil className="w-3.5 h-3.5 mr-2" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => remove(o.opp_id)}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">{o.contact_name || "—"}</div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm font-display font-semibold text-zinc-900 tabular-nums">{fmt(o.amount)}</span>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{o.probability}%</span>
                    </div>
                  </Card>
                ))}
                {list.length === 0 && (
                  <div className="text-xs text-zinc-400 text-center py-6 border border-dashed border-zinc-200 rounded-md">Drop here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <EditOppDialog opp={editing} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  );
}

function EditOppDialog({ opp, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(opp ? { ...opp } : null); }, [opp]);
  if (!form) return null;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title, contact_id: form.contact_id, contact_name: form.contact_name,
        amount: Number(form.amount || 0), currency: form.currency || "USD",
        stage: form.stage, probability: Number(form.probability || 0),
        expected_close: form.expected_close, notes: form.notes,
      };
      await api.patch(`/opportunities/${form.opp_id}`, payload);
      toast.success("Opportunity updated");
      onClose(); onSaved();
    } catch (e2) {
      toast.error(formatApiError(e2.response?.data?.detail) || "Failed");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={!!opp} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-display">Edit opportunity</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label className="text-xs">Title</Label><Input value={form.title || ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required /></div>
            <div><Label className="text-xs">Contact</Label><Input value={form.contact_name || ""} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} /></div>
            <div><Label className="text-xs">Amount</Label><Input type="number" value={form.amount ?? 0} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></div>
            <div><Label className="text-xs">Stage</Label>
              <Select value={form.stage} onValueChange={(v) => setForm((f) => ({ ...f, stage: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Probability</Label><Input type="number" min="0" max="100" value={form.probability ?? 0} onChange={(e) => setForm((f) => ({ ...f, probability: e.target.value }))} /></div>
            <div className="col-span-2"><Label className="text-xs">Notes</Label><Textarea value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} data-testid="opp-save">{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
