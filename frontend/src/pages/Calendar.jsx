import React, { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, Phone, Video, Mail, CheckSquare } from "lucide-react";
import { toast } from "sonner";

const ICON = { call: Phone, meeting: Video, email: Mail, task: CheckSquare };
const TYPE_CLS = {
  call: "bg-blue-50 text-blue-700 border-blue-200",
  meeting: "bg-indigo-50 text-indigo-700 border-indigo-200",
  email: "bg-amber-50 text-amber-700 border-amber-200",
  task: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

function monthStart(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function monthEnd(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function fmtISO(d) { return d.toISOString().slice(0, 10); }
function daySlotKey(iso) { return (iso || "").slice(0, 10); }

export default function CalendarPage() {
  const [cursor, setCursor] = useState(monthStart(new Date()));
  const [events, setEvents] = useState([]);
  const [picked, setPicked] = useState(null);
  const [scheduling, setScheduling] = useState(null);

  const start = monthStart(cursor);
  const end = monthEnd(cursor);

  const load = async () => {
    const { data } = await api.get("/calendar/events", { params: { start: fmtISO(start), end: fmtISO(end) + "T23:59:59" } });
    setEvents(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [cursor]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener("crm:refresh", h);
    return () => window.removeEventListener("crm:refresh", h);
  }, []);

  const eventsByDay = useMemo(() => {
    const map = {};
    events.forEach((e) => {
      const k = daySlotKey(e.due_date);
      if (!k) return;
      (map[k] = map[k] || []).push(e);
    });
    return map;
  }, [events]);

  // Build 6-week grid
  const firstDayIdx = start.getDay(); // 0=Sun
  const gridStart = new Date(start); gridStart.setDate(1 - firstDayIdx);
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d;
  });
  const monthName = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const today = fmtISO(new Date());

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Workspace</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 mt-1">Calendar</h1>
          <p className="text-sm text-zinc-600 mt-1">Activities, calls and meetings scheduled with due dates.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCursor(monthStart(new Date()))} data-testid="cal-today">Today</Button>
          <button onClick={() => setCursor(addMonths(cursor, -1))} data-testid="cal-prev" className="h-9 w-9 rounded-md border border-zinc-200 hover:bg-zinc-100 inline-flex items-center justify-center">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="font-display font-semibold text-zinc-900 min-w-[180px] text-center tabular-nums">{monthName}</div>
          <button onClick={() => setCursor(addMonths(cursor, 1))} data-testid="cal-next" className="h-9 w-9 rounded-md border border-zinc-200 hover:bg-zinc-100 inline-flex items-center justify-center">
            <ChevronRight className="w-4 h-4" />
          </button>
          <Button onClick={() => setScheduling({ date: today })} data-testid="cal-new-event">
            <Plus className="w-4 h-4 mr-1.5" /> Schedule
          </Button>
        </div>
      </div>

      <Card className="rounded-md border border-zinc-200 shadow-none overflow-hidden" data-testid="calendar-grid">
        <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium text-center py-2 border-r border-zinc-200 last:border-r-0">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const iso = fmtISO(d);
            const inMonth = d.getMonth() === cursor.getMonth();
            const isToday = iso === today;
            const dayEvents = eventsByDay[iso] || [];
            return (
              <button
                key={i}
                onClick={() => setPicked({ date: iso, events: dayEvents })}
                data-testid={`cal-day-${iso}`}
                className={`min-h-[110px] text-left border-r border-b border-zinc-200 p-2 hover:bg-zinc-50 transition-colors ${inMonth ? "bg-white" : "bg-zinc-50/50"} ${i % 7 === 6 ? "border-r-0" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium tabular-nums ${isToday ? "bg-zinc-900 text-white rounded-sm px-1.5 py-0.5" : inMonth ? "text-zinc-900" : "text-zinc-400"}`}>
                    {d.getDate()}
                  </span>
                  {dayEvents.length > 0 && <span className="text-[10px] text-zinc-500 tabular-nums">{dayEvents.length}</span>}
                </div>
                <div className="mt-1.5 space-y-1">
                  {dayEvents.slice(0, 3).map((e) => {
                    const Icon = ICON[e.type] || CheckSquare;
                    const cls = TYPE_CLS[e.type] || TYPE_CLS.task;
                    return (
                      <div key={e.activity_id} className={`text-[11px] px-1.5 py-0.5 rounded-sm border truncate flex items-center gap-1 ${cls}`}>
                        <Icon className="w-2.5 h-2.5 flex-shrink-0" />
                        <span className="truncate">{e.title}</span>
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && <div className="text-[10px] text-zinc-500 pl-1.5">+{dayEvents.length - 3} more</div>}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <DayEventsDialog picked={picked} onClose={() => setPicked(null)} onSchedule={(iso) => { setPicked(null); setScheduling({ date: iso }); }} />
      <ScheduleDialog
        open={!!scheduling}
        initialDate={scheduling?.date}
        onOpenChange={(o) => !o && setScheduling(null)}
        onSaved={() => { setScheduling(null); load(); }}
      />
    </div>
  );
}

function DayEventsDialog({ picked, onClose, onSchedule }) {
  if (!picked) return null;
  const fmtDate = new Date(picked.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  return (
    <Dialog open={!!picked} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="cal-day-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">{fmtDate}</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto -mx-6 px-6">
          {picked.events.length === 0 ? (
            <div className="text-sm text-zinc-500 text-center py-8">Nothing scheduled.</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {picked.events.map((e) => {
                const Icon = ICON[e.type] || CheckSquare;
                return (
                  <div key={e.activity_id} className="py-3 flex items-start gap-3">
                    <Icon className="w-4 h-4 text-zinc-500 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-zinc-900">{e.title}</div>
                      {e.description && <div className="text-xs text-zinc-500 mt-0.5">{e.description}</div>}
                      {e.related_to_name && <div className="text-[11px] text-zinc-400 mt-0.5">→ {e.related_to_name}</div>}
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${e.status === "done" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                      {e.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => onSchedule(picked.date)} data-testid="cal-day-schedule"><Plus className="w-4 h-4 mr-1.5" /> Schedule on this day</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({ open, initialDate, onOpenChange, onSaved }) {
  const [form, setForm] = useState({ title: "", type: "meeting", description: "", due_date: "", due_time: "10:00" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm((f) => ({ ...f, due_date: initialDate || fmtISO(new Date()), title: "", description: "" }));
  }, [open, initialDate]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const due = `${form.due_date}T${form.due_time || "10:00"}:00`;
      await api.post("/activities", {
        type: form.type, title: form.title, description: form.description || null,
        due_date: due, status: "pending",
      });
      toast.success("Scheduled");
      onSaved();
    } catch (e2) {
      toast.error(formatApiError(e2.response?.data?.detail) || "Failed");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="cal-schedule-dialog">
        <DialogHeader><DialogTitle className="font-display">Schedule activity</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div><Label className="text-xs">Title</Label>
            <Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} data-testid="sched-title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger data-testid="sched-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Date</Label>
                <Input type="date" required value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} data-testid="sched-date" />
              </div>
              <div><Label className="text-xs">Time</Label>
                <Input type="time" value={form.due_time} onChange={(e) => setForm((f) => ({ ...f, due_time: e.target.value }))} />
              </div>
            </div>
          </div>
          <div><Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving} data-testid="sched-save">{saving ? "Saving…" : "Schedule"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
