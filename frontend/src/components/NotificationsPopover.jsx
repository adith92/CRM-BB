import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { api } from "../lib/api";
import { formatDistanceToNow } from "date-fns";

export default function NotificationsPopover() {
  const [items, setItems] = useState([]);

  const load = async () => {
    try {
      const { data } = await api.get("/activities", { params: { status: "pending" } });
      setItems(data.slice(0, 6));
    } catch {}
  };

  useEffect(() => {
    load();
    const onRefresh = () => load();
    window.addEventListener("crm:refresh", onRefresh);
    return () => window.removeEventListener("crm:refresh", onRefresh);
  }, []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative h-9 w-9 rounded-md hover:bg-zinc-100 inline-flex items-center justify-center"
          data-testid="notifications-btn"
          aria-label="Notifications"
        >
          <Bell className="w-[18px] h-[18px] text-zinc-600" strokeWidth={1.6} />
          {items.length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-zinc-900 ring-2 ring-white" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-zinc-200">
          <div className="font-display font-semibold text-zinc-900">Pending activities</div>
          <div className="text-xs text-zinc-500">{items.length} open</div>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100">
          {items.length === 0 && (
            <div className="px-4 py-6 text-sm text-zinc-500 text-center">All caught up.</div>
          )}
          {items.map((a) => (
            <div key={a.activity_id} className="px-4 py-3 hover:bg-zinc-50">
              <div className="text-sm font-medium text-zinc-900">{a.title}</div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {a.type} · {a.related_to_name || "—"} · {a.created_at ? formatDistanceToNow(new Date(a.created_at), { addSuffix: true }) : ""}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
