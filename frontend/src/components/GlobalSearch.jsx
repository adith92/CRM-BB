import React, { useEffect, useState } from "react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "./ui/command";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Users, Briefcase, Building2, CheckSquare } from "lucide-react";

export default function GlobalSearch({ open, onOpenChange }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState({ leads: [], opportunities: [], contacts: [], activities: [] });
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) { setQ(""); return; }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) { setResults({ leads: [], opportunities: [], contacts: [], activities: [] }); return; }
      try {
        const { data } = await api.get("/search", { params: { q } });
        setResults(data);
      } catch {}
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const go = (path) => { onOpenChange(false); navigate(path); };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={q}
        onValueChange={setQ}
        placeholder="Search across leads, opportunities, contacts, activities…"
        data-testid="global-search-input"
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {results.leads?.length > 0 && (
          <CommandGroup heading="Leads">
            {results.leads.map((l) => (
              <CommandItem key={l.lead_id} onSelect={() => go("/leads")} data-testid={`search-lead-${l.lead_id}`}>
                <Users className="w-4 h-4 mr-2 text-zinc-500" /> {l.name}
                {l.company_name && <span className="ml-2 text-xs text-zinc-500">{l.company_name}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.opportunities?.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Opportunities">
              {results.opportunities.map((o) => (
                <CommandItem key={o.opp_id} onSelect={() => go("/pipeline")} data-testid={`search-opp-${o.opp_id}`}>
                  <Briefcase className="w-4 h-4 mr-2 text-zinc-500" /> {o.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {results.contacts?.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Contacts">
              {results.contacts.map((c) => (
                <CommandItem key={c.contact_id} onSelect={() => go("/contacts")} data-testid={`search-contact-${c.contact_id}`}>
                  <Building2 className="w-4 h-4 mr-2 text-zinc-500" /> {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {results.activities?.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Activities">
              {results.activities.map((a) => (
                <CommandItem key={a.activity_id} onSelect={() => go("/activities")} data-testid={`search-activity-${a.activity_id}`}>
                  <CheckSquare className="w-4 h-4 mr-2 text-zinc-500" /> {a.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
