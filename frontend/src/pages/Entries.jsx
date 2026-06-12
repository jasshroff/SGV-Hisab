import React, { useEffect, useMemo, useState } from "react";
import api, { API, formatApiErrorDetail } from "@/lib/api";
import { PageHeader, fmt, fmtINR, TypePill } from "@/components/Bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Plus, Download, Pencil, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import EntryDialog from "@/components/EntryDialog";
import { toast } from "sonner";

function DateButton({ value, onChange, placeholder, testid }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start font-normal" data-testid={testid}>
          <CalendarIcon className="w-4 h-4 mr-2" />
          {value ? format(parseISO(value), "dd MMM yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value ? parseISO(value) : undefined}
          onSelect={(d) => onChange(d ? format(d, "yyyy-MM-dd") : "")} />
      </PopoverContent>
    </Popover>
  );
}

export default function Entries() {
  const [entries, setEntries] = useState([]);
  const [parties, setParties] = useState([]);
  const [filters, setFilters] = useState({ start: "", end: "", party: "all", type: "all" });
  const [open, setOpen] = useState(false);
  const [editEntry, setEditEntry] = useState(null);

  const load = async () => {
    const q = new URLSearchParams();
    if (filters.start) q.append("start_date", filters.start);
    if (filters.end) q.append("end_date", filters.end);
    if (filters.party && filters.party !== "all") q.append("party_id", filters.party);
    if (filters.type && filters.type !== "all") q.append("type", filters.type);
    const [e, p] = await Promise.all([api.get(`/entries?${q.toString()}`), api.get("/parties")]);
    setEntries(e.data); setParties(p.data);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filters]);

  const totals = useMemo(() => {
    const t = { jama: { gold: 0, fine_gold: 0, silver: 0, amount: 0 }, naame: { gold: 0, fine_gold: 0, silver: 0, amount: 0 } };
    entries.forEach((e) => {
      const k = e.type;
      if (!t[k]) return;
      t[k].gold += e.gold; t[k].fine_gold += e.fine_gold; t[k].silver += e.silver; t[k].amount += e.amount;
    });
    return t;
  }, [entries]);

  const onDelete = async (id) => {
    if (!window.confirm("Delete this entry?")) return;
    try { await api.delete(`/entries/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const onExport = async () => {
    const q = new URLSearchParams();
    if (filters.start) q.append("start_date", filters.start);
    if (filters.end) q.append("end_date", filters.end);
    if (filters.party && filters.party !== "all") q.append("party_id", filters.party);
    const url = `${API}/reports/export?${q.toString()}`;
    try {
      const token = localStorage.getItem("access_token");
      const resp = await fetch(url, { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!resp.ok) throw new Error("Export failed");
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `hisab_${filters.start || "all"}_${filters.end || "all"}.xlsx`;
      a.click();
    } catch (err) { toast.error("Export failed"); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto" data-testid="entries-page">
      <PageHeader title="Entries Ledger" hindi="बही" subtitle="All Jama / Naame entries"
        actions={
          <>
            <Button variant="outline" onClick={onExport} data-testid="entries-export-button"><Download className="w-4 h-4 mr-1.5" /> Excel</Button>
            <Button className="gold-btn" onClick={() => { setEditEntry(null); setOpen(true); }} data-testid="entries-new-button"><Plus className="w-4 h-4 mr-1.5" /> New Entry</Button>
          </>
        }
      />

      <div className="bg-white border border-[var(--border)] rounded-sm shadow-ledger p-4 mb-5 grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <Label className="text-xs">From <span className="font-hindi text-muted-foreground">से</span></Label>
          <div className="mt-1.5"><DateButton value={filters.start} onChange={(v) => setFilters({ ...filters, start: v })} placeholder="Start date" testid="filter-start-date" /></div>
        </div>
        <div>
          <Label className="text-xs">To <span className="font-hindi text-muted-foreground">तक</span></Label>
          <div className="mt-1.5"><DateButton value={filters.end} onChange={(v) => setFilters({ ...filters, end: v })} placeholder="End date" testid="filter-end-date" /></div>
        </div>
        <div>
          <Label className="text-xs">Party</Label>
          <Select value={filters.party} onValueChange={(v) => setFilters({ ...filters, party: v })}>
            <SelectTrigger className="mt-1.5" data-testid="filter-party"><SelectValue placeholder="All parties" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All parties</SelectItem>
              {parties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Type</Label>
          <Select value={filters.type} onValueChange={(v) => setFilters({ ...filters, type: v })}>
            <SelectTrigger className="mt-1.5" data-testid="filter-type"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="jama">Jama (जमा)</SelectItem>
              <SelectItem value="naame">Naame (नामे)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button variant="outline" className="w-full" onClick={() => setFilters({ start: "", end: "", party: "all", type: "all" })} data-testid="filter-clear">Clear</Button>
        </div>
      </div>

      <div className="bg-white border border-[var(--border)] rounded-sm shadow-ledger overflow-x-auto">
        <table className="w-full ledger-table" data-testid="entries-table">
          <thead>
            <tr>
              <th className="text-left">Date</th>
              <th className="text-left">Party</th>
              <th className="text-left">Item</th>
              <th className="text-left">Type</th>
              <th className="text-right">Gold</th>
              <th className="text-right">Fine</th>
              <th className="text-right">Silver</th>
              <th className="text-right">Touch%</th>
              <th className="text-right">Amount</th>
              <th className="text-left">By</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.length ? entries.map((e) => (
              <tr key={e.id}>
                <td>{format(parseISO(e.date), "dd MMM yyyy")}</td>
                <td className="font-medium">{e.party_name}</td>
                <td>{e.item_name}</td>
                <td><TypePill type={e.type} /></td>
                <td className="text-right">{fmt(e.gold)}</td>
                <td className="text-right">{fmt(e.fine_gold)}</td>
                <td className="text-right">{fmt(e.silver)}</td>
                <td className="text-right">{fmt(e.touch, 2)}</td>
                <td className={`text-right font-semibold ${e.type === "jama" ? "text-[var(--jama)]" : "text-[var(--naame)]"}`}>{fmtINR(e.amount)}</td>
                <td className="text-xs text-muted-foreground">{e.created_by_name}</td>
                <td className="text-right whitespace-nowrap">
                  <button className="p-1.5 hover:bg-[#f3f1ea] rounded-sm" onClick={() => { setEditEntry(e); setOpen(true); }} data-testid={`edit-entry-${e.id}`}><Pencil className="w-3.5 h-3.5" /></button>
                  <button className="p-1.5 hover:bg-[#f9eaea] rounded-sm text-[var(--naame)]" onClick={() => onDelete(e.id)} data-testid={`delete-entry-${e.id}`}><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={11} className="text-center text-muted-foreground py-8">No entries found.</td></tr>
            )}
          </tbody>
          {entries.length > 0 && (
            <tfoot>
              <tr style={{ background: "#f5ebd2" }}>
                <td colSpan={4} className="font-semibold uppercase text-xs">Total Jama</td>
                <td className="text-right font-semibold text-[var(--jama)]">{fmt(totals.jama.gold)}</td>
                <td className="text-right font-semibold text-[var(--jama)]">{fmt(totals.jama.fine_gold)}</td>
                <td className="text-right font-semibold text-[var(--jama)]">{fmt(totals.jama.silver)}</td>
                <td></td>
                <td className="text-right font-semibold text-[var(--jama)]">{fmtINR(totals.jama.amount)}</td>
                <td colSpan={2}></td>
              </tr>
              <tr style={{ background: "#fbf3f3" }}>
                <td colSpan={4} className="font-semibold uppercase text-xs">Total Naame</td>
                <td className="text-right font-semibold text-[var(--naame)]">{fmt(totals.naame.gold)}</td>
                <td className="text-right font-semibold text-[var(--naame)]">{fmt(totals.naame.fine_gold)}</td>
                <td className="text-right font-semibold text-[var(--naame)]">{fmt(totals.naame.silver)}</td>
                <td></td>
                <td className="text-right font-semibold text-[var(--naame)]">{fmtINR(totals.naame.amount)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <EntryDialog open={open} onOpenChange={setOpen} parties={parties} editEntry={editEntry} onSaved={load} />
    </div>
  );
}
