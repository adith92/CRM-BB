import React, { useState } from "react";
import { Plus, Users, Briefcase, Building2, CheckSquare } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { api, formatApiError } from "../lib/api";
import { toast } from "sonner";

const FORMS = {
  lead: {
    label: "Lead", icon: Users, endpoint: "/leads",
    fields: [
      { name: "name", label: "Full name", required: true },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Phone" },
      { name: "company_name", label: "Company" },
      { name: "source", label: "Source", placeholder: "Website, Referral…" },
    ],
  },
  opportunity: {
    label: "Opportunity", icon: Briefcase, endpoint: "/opportunities",
    fields: [
      { name: "title", label: "Title", required: true },
      { name: "contact_name", label: "Contact" },
      { name: "amount", label: "Amount", type: "number" },
      { name: "stage", label: "Stage", type: "select", options: [
        ["prospecting", "Prospecting"], ["qualification", "Qualification"],
        ["proposal", "Proposal"], ["negotiation", "Negotiation"],
        ["won", "Won"], ["lost", "Lost"],
      ] },
    ],
  },
  contact: {
    label: "Contact", icon: Building2, endpoint: "/contacts",
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "type", label: "Type", type: "select", options: [["person", "Person"], ["company", "Company"]] },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Phone" },
      { name: "company_name", label: "Company" },
      { name: "title", label: "Title" },
    ],
  },
  activity: {
    label: "Activity", icon: CheckSquare, endpoint: "/activities",
    fields: [
      { name: "title", label: "Title", required: true },
      { name: "type", label: "Type", type: "select", options: [
        ["task", "Task"], ["call", "Call"], ["meeting", "Meeting"], ["email", "Email"],
      ] },
      { name: "description", label: "Description", type: "textarea" },
    ],
  },
};

export default function QuickCreate() {
  const [entity, setEntity] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  const open = (key) => { setEntity(key); setValues({}); };
  const close = () => { setEntity(null); setValues({}); };

  const submit = async (e) => {
    e.preventDefault();
    const cfg = FORMS[entity];
    setSaving(true);
    try {
      const payload = { ...values };
      if (payload.amount) payload.amount = Number(payload.amount);
      await api.post(cfg.endpoint, payload);
      toast.success(`${cfg.label} created`);
      close();
      // soft refresh signal
      window.dispatchEvent(new CustomEvent("crm:refresh"));
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const cfg = entity ? FORMS[entity] : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="h-9 px-3 rounded-md bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 inline-flex items-center gap-1.5"
            data-testid="quick-create-btn"
          >
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Create</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {Object.entries(FORMS).map(([k, v]) => (
            <DropdownMenuItem key={k} onClick={() => open(k)} data-testid={`qc-${k}`}>
              <v.icon className="w-4 h-4 mr-2" /> New {v.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!entity} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md" data-testid="quick-create-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">New {cfg?.label}</DialogTitle>
            <DialogDescription>Fill in the basics — you can edit details later.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            {cfg?.fields.map((f) => (
              <div key={f.name} className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-700">{f.label}{f.required && <span className="text-red-500"> *</span>}</Label>
                {f.type === "textarea" ? (
                  <Textarea
                    value={values[f.name] || ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    data-testid={`qc-field-${f.name}`}
                  />
                ) : f.type === "select" ? (
                  <Select value={values[f.name] || ""} onValueChange={(val) => setValues((v) => ({ ...v, [f.name]: val }))}>
                    <SelectTrigger data-testid={`qc-field-${f.name}`}><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {f.options.map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={f.type || "text"}
                    value={values[f.name] || ""}
                    placeholder={f.placeholder}
                    required={f.required}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    data-testid={`qc-field-${f.name}`}
                  />
                )}
              </div>
            ))}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} data-testid="qc-cancel">Cancel</Button>
              <Button type="submit" disabled={saving} data-testid="qc-submit">
                {saving ? "Saving…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
