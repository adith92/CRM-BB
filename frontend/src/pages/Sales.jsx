import React, { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Plus, Trash2, Pencil, FileText, Truck, CheckCircle2, XCircle, ArrowRightCircle } from "lucide-react";
import { toast } from "sonner";

const QUOTE_STATUS = [
  { value: "draft", label: "Draft", cls: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  { value: "sent", label: "Sent", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "accepted", label: "Accepted", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "rejected", label: "Rejected", cls: "bg-red-50 text-red-700 border-red-200" },
  { value: "invoiced", label: "Invoiced", cls: "bg-zinc-900 text-white border-zinc-900" },
];
const ORDER_STATUS = [
  { value: "pending", label: "Pending", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "confirmed", label: "Confirmed", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "shipped", label: "Shipped", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { value: "delivered", label: "Delivered", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "cancelled", label: "Cancelled", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
];

const fmt = (n, c = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: c, maximumFractionDigits: 2 }).format(n || 0);

export default function Sales() {
  const [tab, setTab] = useState("quotations");
  const [quotes, setQuotes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const [q, o] = await Promise.all([api.get("/quotations"), api.get("/orders")]);
    setQuotes(q.data); setOrders(o.data);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const h = () => load();
    window.addEventListener("crm:refresh", h);
    return () => window.removeEventListener("crm:refresh", h);
  }, []);

  const removeQuote = async (id) => {
    if (!window.confirm("Delete this quotation?")) return;
    await api.delete(`/quotations/${id}`); toast.success("Deleted"); load();
  };
  const convertQuote = async (id) => {
    try {
      const { data } = await api.post(`/quotations/${id}/convert-to-order`);
      toast.success(`Order ${data.number} created`);
      setTab("orders"); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || "Failed"); }
  };
  const setQuoteStatus = async (id, status) => {
    await api.patch(`/quotations/${id}/status`, { status });
    toast.success(`Marked ${status}`); load();
  };
  const setOrderStatus = async (id, status) => {
    await api.patch(`/orders/${id}/status`, { status });
    toast.success(`Order ${status}`); load();
  };
  const removeOrder = async (id) => {
    if (!window.confirm("Delete this order?")) return;
    await api.delete(`/orders/${id}`); toast.success("Deleted"); load();
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Sales</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 mt-1">Quotations & Orders</h1>
          <p className="text-sm text-zinc-600 mt-1">Create quotes from opportunities, convert to orders, track fulfillment.</p>
        </div>
        {tab === "quotations" && (
          <Button onClick={() => setCreating(true)} data-testid="new-quote-btn">
            <Plus className="w-4 h-4 mr-1.5" /> New quote
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-transparent border-b border-zinc-200 rounded-none p-0 h-9 w-full justify-start gap-4">
          <TabsTrigger value="quotations" data-testid="tab-quotations" className="data-[state=active]:border-b-2 data-[state=active]:border-zinc-900 data-[state=active]:text-zinc-900 data-[state=active]:shadow-none rounded-none px-1 py-2 text-zinc-500">
            Quotations <span className="ml-1.5 text-[10px] bg-zinc-100 border border-zinc-200 rounded-sm px-1">{quotes.length}</span>
          </TabsTrigger>
          <TabsTrigger value="orders" data-testid="tab-orders" className="data-[state=active]:border-b-2 data-[state=active]:border-zinc-900 data-[state=active]:text-zinc-900 data-[state=active]:shadow-none rounded-none px-1 py-2 text-zinc-500">
            Orders <span className="ml-1.5 text-[10px] bg-zinc-100 border border-zinc-200 rounded-sm px-1">{orders.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quotations" className="mt-5">
          <Card className="rounded-md border border-zinc-200 shadow-none overflow-hidden" data-testid="quotations-table">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-zinc-500 py-12">
                    <FileText className="w-5 h-5 mx-auto text-zinc-400 mb-2" />
                    No quotations yet. Create one from an opportunity (pipeline card menu) or click New quote.
                  </TableCell></TableRow>
                )}
                {quotes.map((q) => {
                  const s = QUOTE_STATUS.find((x) => x.value === q.status);
                  return (
                    <TableRow key={q.quotation_id} data-testid={`quote-row-${q.quotation_id}`}>
                      <TableCell className="font-mono text-xs text-zinc-900">{q.number}</TableCell>
                      <TableCell className="font-medium text-zinc-900">{q.title}</TableCell>
                      <TableCell className="hidden md:table-cell text-zinc-600">{q.contact_name || "—"}</TableCell>
                      <TableCell>
                        <Select value={q.status} onValueChange={(v) => setQuoteStatus(q.quotation_id, v)}>
                          <SelectTrigger className="h-7 w-32 text-xs" data-testid={`quote-status-${q.quotation_id}`}>
                            <SelectValue asChild><span className={`text-[11px] font-medium px-2 py-0.5 rounded-sm border ${s?.cls}`}>{s?.label}</span></SelectValue>
                          </SelectTrigger>
                          <SelectContent>{QUOTE_STATUS.map((x) => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right font-display font-semibold tabular-nums">{fmt(q.total, q.currency)}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <button onClick={() => setEditing(q)} className="h-8 w-8 rounded-md hover:bg-zinc-100 inline-flex items-center justify-center" data-testid={`quote-edit-${q.quotation_id}`}>
                            <Pencil className="w-3.5 h-3.5 text-zinc-600" />
                          </button>
                          <button onClick={() => convertQuote(q.quotation_id)} title="Convert to order" className="h-8 w-8 rounded-md hover:bg-zinc-100 inline-flex items-center justify-center" data-testid={`quote-convert-${q.quotation_id}`}>
                            <ArrowRightCircle className="w-3.5 h-3.5 text-zinc-600" />
                          </button>
                          <button onClick={() => removeQuote(q.quotation_id)} className="h-8 w-8 rounded-md hover:bg-zinc-100 inline-flex items-center justify-center text-red-600" data-testid={`quote-delete-${q.quotation_id}`}>
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
        </TabsContent>

        <TabsContent value="orders" className="mt-5">
          <Card className="rounded-md border border-zinc-200 shadow-none overflow-hidden" data-testid="orders-table">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-zinc-500 py-12">
                    <Truck className="w-5 h-5 mx-auto text-zinc-400 mb-2" />
                    No orders yet. Convert an accepted quotation to generate one.
                  </TableCell></TableRow>
                )}
                {orders.map((o) => {
                  const s = ORDER_STATUS.find((x) => x.value === o.status);
                  return (
                    <TableRow key={o.order_id} data-testid={`order-row-${o.order_id}`}>
                      <TableCell className="font-mono text-xs text-zinc-900">{o.number}</TableCell>
                      <TableCell className="font-medium text-zinc-900">{o.title}</TableCell>
                      <TableCell className="hidden md:table-cell text-zinc-600">{o.contact_name || "—"}</TableCell>
                      <TableCell>
                        <Select value={o.status} onValueChange={(v) => setOrderStatus(o.order_id, v)}>
                          <SelectTrigger className="h-7 w-32 text-xs" data-testid={`order-status-${o.order_id}`}>
                            <SelectValue asChild><span className={`text-[11px] font-medium px-2 py-0.5 rounded-sm border ${s?.cls}`}>{s?.label}</span></SelectValue>
                          </SelectTrigger>
                          <SelectContent>{ORDER_STATUS.map((x) => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right font-display font-semibold tabular-nums">{fmt(o.total, o.currency)}</TableCell>
                      <TableCell className="text-right">
                        <button onClick={() => removeOrder(o.order_id)} className="h-8 w-8 rounded-md hover:bg-zinc-100 inline-flex items-center justify-center text-red-600" data-testid={`order-delete-${o.order_id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <QuoteDialog
        open={creating || !!editing}
        initial={editing}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        onSaved={() => { setCreating(false); setEditing(null); load(); }}
      />
    </div>
  );
}

function QuoteDialog({ open, onOpenChange, initial, onSaved }) {
  const [form, setForm] = useState({ title: "", contact_name: "", currency: "USD", notes: "", valid_until: "", status: "draft", items: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) setForm({
      title: initial.title || "", contact_name: initial.contact_name || "",
      currency: initial.currency || "USD", notes: initial.notes || "",
      valid_until: initial.valid_until || "", status: initial.status || "draft",
      items: initial.items?.length ? initial.items : [{ name: "", quantity: 1, unit_price: 0, tax_pct: 0 }],
    });
    else setForm({ title: "", contact_name: "", currency: "USD", notes: "", valid_until: "", status: "draft",
      items: [{ name: "", quantity: 1, unit_price: 0, tax_pct: 0 }] });
  }, [initial, open]);

  const totals = useMemo(() => {
    let sub = 0, tax = 0;
    (form.items || []).forEach((it) => {
      const line = Number(it.quantity || 0) * Number(it.unit_price || 0);
      sub += line;
      tax += line * (Number(it.tax_pct || 0) / 100);
    });
    return { sub, tax, total: sub + tax };
  }, [form.items]);

  const updateItem = (i, k, v) => setForm((f) => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }));
  const addItem = () => setForm((f) => ({ ...f, items: [...(f.items || []), { name: "", quantity: 1, unit_price: 0, tax_pct: 0 }] }));
  const removeItem = (i) => setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        items: form.items.map((it) => ({
          ...it,
          quantity: Number(it.quantity || 0),
          unit_price: Number(it.unit_price || 0),
          tax_pct: Number(it.tax_pct || 0),
        })),
      };
      if (initial) await api.patch(`/quotations/${initial.quotation_id}`, payload);
      else await api.post("/quotations", payload);
      toast.success(initial ? "Quote updated" : "Quote created");
      onSaved();
    } catch (e2) {
      toast.error(formatApiError(e2.response?.data?.detail) || "Failed");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-testid="quote-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">{initial ? `Edit ${initial.number}` : "New quotation"}</DialogTitle>
          <DialogDescription>Line items calculate subtotal, tax and total automatically.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label className="text-xs">Title</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required data-testid="quote-title" />
            </div>
            <div><Label className="text-xs">Contact name</Label>
              <Input value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} />
            </div>
            <div><Label className="text-xs">Valid until</Label>
              <Input type="date" value={form.valid_until || ""} onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Line items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem} data-testid="quote-add-item"><Plus className="w-3.5 h-3.5 mr-1" /> Add item</Button>
            </div>
            <div className="border border-zinc-200 rounded-md overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-zinc-50 border-b border-zinc-200 text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                <div className="col-span-5">Item</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-2 text-right">Price</div>
                <div className="col-span-2 text-right">Tax %</div>
                <div className="col-span-1"></div>
              </div>
              {form.items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-zinc-100 last:border-b-0 items-center">
                  <Input value={it.name} onChange={(e) => updateItem(i, "name", e.target.value)} placeholder="Item" className="col-span-5 h-8 text-sm" required data-testid={`quote-item-name-${i}`} />
                  <Input type="number" min="0" step="0.01" value={it.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} className="col-span-2 h-8 text-sm text-right" />
                  <Input type="number" min="0" step="0.01" value={it.unit_price} onChange={(e) => updateItem(i, "unit_price", e.target.value)} className="col-span-2 h-8 text-sm text-right" />
                  <Input type="number" min="0" step="0.01" value={it.tax_pct} onChange={(e) => updateItem(i, "tax_pct", e.target.value)} className="col-span-2 h-8 text-sm text-right" />
                  <button type="button" onClick={() => removeItem(i)} className="col-span-1 text-zinc-400 hover:text-red-600 flex justify-center">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end gap-6 text-sm">
              <div><span className="text-zinc-500">Subtotal:</span> <span className="font-display font-semibold tabular-nums ml-1">{fmt(totals.sub, form.currency)}</span></div>
              <div><span className="text-zinc-500">Tax:</span> <span className="font-display font-semibold tabular-nums ml-1">{fmt(totals.tax, form.currency)}</span></div>
              <div><span className="text-zinc-500">Total:</span> <span className="font-display font-semibold tabular-nums ml-1 text-zinc-900">{fmt(totals.total, form.currency)}</span></div>
            </div>
          </div>

          <div><Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving} data-testid="quote-save">{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
