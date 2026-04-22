import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Card } from "../components/ui/card";
import { Phone, Video, Mail, CheckSquare, Check, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const ICON = { call: Phone, meeting: Video, email: Mail, task: CheckSquare };

export default function Activities() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("all");

  const load = async () => {
    const { data } = await api.get("/activities");
    setItems(data);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const h = () => load();
    window.addEventListener("crm:refresh", h);
    return () => window.removeEventListener("crm:refresh", h);
  }, []);

  const filtered = items.filter((a) => {
    if (tab === "all") return true;
    if (tab === "pending") return a.status === "pending";
    if (tab === "done") return a.status === "done";
    return a.type === tab;
  });

  const toggle = async (id) => {
    await api.post(`/activities/${id}/toggle`);
    load();
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this activity?")) return;
    await api.delete(`/activities/${id}`);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1000px] mx-auto">
      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Workspace</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 mt-1">Activities</h1>
        <p className="text-sm text-zinc-600 mt-1">Tasks, calls, meetings and emails across your pipeline.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-transparent border-b border-zinc-200 rounded-none p-0 h-9 w-full justify-start gap-4">
          {["all", "pending", "done", "task", "call", "meeting", "email"].map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              data-testid={`activities-tab-${t}`}
              className="data-[state=active]:border-b-2 data-[state=active]:border-zinc-900 data-[state=active]:text-zinc-900 data-[state=active]:shadow-none rounded-none px-1 py-2 text-zinc-500 capitalize"
            >
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab} className="mt-6">
          <Card className="rounded-md border border-zinc-200 shadow-none" data-testid="activities-list">
            {filtered.length === 0 && <div className="text-center text-sm text-zinc-500 py-12">No activities here.</div>}
            <div className="divide-y divide-zinc-100">
              {filtered.map((a) => {
                const Icon = ICON[a.type] || CheckSquare;
                const done = a.status === "done";
                return (
                  <div key={a.activity_id} className="p-4 flex items-start gap-3 hover:bg-zinc-50 group" data-testid={`activity-row-${a.activity_id}`}>
                    <button
                      onClick={() => toggle(a.activity_id)}
                      data-testid={`activity-toggle-${a.activity_id}`}
                      className={`mt-0.5 w-5 h-5 rounded-sm border inline-flex items-center justify-center ${done ? "bg-zinc-900 border-zinc-900 text-white" : "border-zinc-300 hover:border-zinc-900"}`}
                    >
                      {done && <Check className="w-3 h-3" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-zinc-400" />
                        <div className={`text-sm font-medium ${done ? "text-zinc-400 line-through" : "text-zinc-900"}`}>{a.title}</div>
                      </div>
                      {a.description && <div className="text-xs text-zinc-500 mt-1 ml-5">{a.description}</div>}
                      <div className="text-[11px] text-zinc-400 mt-1.5 ml-5">
                        <span className="uppercase tracking-wider">{a.type}</span>
                        {a.related_to_name && <> · {a.related_to_name}</>}
                        {a.owner_name && <> · {a.owner_name}</>}
                        {a.created_at && <> · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</>}
                      </div>
                    </div>
                    <button
                      onClick={() => remove(a.activity_id)}
                      className="opacity-0 group-hover:opacity-100 h-8 w-8 rounded-md hover:bg-zinc-100 inline-flex items-center justify-center text-red-600"
                      data-testid={`activity-delete-${a.activity_id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
