import React, { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { fmt, fmtINR, TypePill } from "@/components/Bits";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { CalendarClock, Play, Undo2, AlertTriangle } from "lucide-react";

function thisMonthMinusOne() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Closings() {
  const { user } = useAuth();
  const [closings, setClosings] = useState([]);
  const [period, setPeriod] = useState(thisMonthMinusOne());
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isAdmin = user?.role === "admin";

  const loadClosings = async () => {
    const r = await api.get("/closings");
    setClosings(r.data);
  };
  useEffect(() => { loadClosings(); }, []);

  const runPreview = async () => {
    setPreview(null);
    if (!/^\d{4}-\d{2}$/.test(period)) {
      toast.error("Period must be YYYY-MM"); return;
    }
    setBusy(true);
    try {
      const r = await api.get(`/closings/preview?period=${period}`);
      setPreview(r.data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  const runClosing = async () => {
    setBusy(true);
    try {
      const r = await api.post("/closings/run", { period });
      toast.success(`Closed ${period}: ${r.data.created} opening entries created on ${r.data.opening_date}`);
      setPreview(null);
      setConfirmOpen(false);
      loadClosings();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  const undoClosing = async (p) => {
    if (!window.confirm(`Undo closing for ${p}? This deletes all opening entries created for it.`)) return;
    try {
      const r = await api.delete(`/closings/${p}`);
      toast.success(`Undone · ${r.data.deleted_entries} entries removed`);
      loadClosings();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6" data-testid="closings-tab">
      <div className="bg-white border border-[var(--border)] rounded-sm shadow-ledger p-5">
        <div className="flex items-center gap-2 mb-2">
          <CalendarClock className="w-4 h-4 text-[#b38c3b]" />
          <h3 className="font-display text-lg font-bold">Month-End Closing</h3>
          <span className="font-hindi text-sm text-muted-foreground">मासिक समापन</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Carries each party's net balance up to the last day of the selected month forward as an
          <span className="font-semibold"> "Opening Balance"</span> entry on the 1st of the next month.
          Jama if balance is positive, Naame if negative.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-[200px_auto_auto] gap-3 items-end">
          <div>
            <Label className="text-xs">Period (YYYY-MM)</Label>
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-02" className="mt-1.5 tabular-nums" data-testid="closing-period-input" />
          </div>
          <Button variant="outline" onClick={runPreview} disabled={busy} data-testid="closing-preview-button">Preview</Button>
          {isAdmin && (
            <Button onClick={() => setConfirmOpen(true)} disabled={!preview || preview.already_run || preview.parties_with_balance.length === 0} className="gold-btn" data-testid="closing-run-button">
              <Play className="w-4 h-4 mr-1.5" /> Run Closing
            </Button>
          )}
        </div>

        {preview && (
          <div className="mt-5">
            {preview.already_run && (
              <div className="mb-3 text-sm bg-[#f5ebd2] border border-[#e0c789] text-[#7a5b1d] px-3 py-2 rounded-sm flex gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                Closing for {preview.period} has already been run. Undo it below before re-running.
              </div>
            )}
            <div className="text-sm text-muted-foreground mb-2">
              {preview.parties_with_balance.length} party balance(s) will be carried forward to <b>{preview.opening_date}</b>.
            </div>
            <div className="bg-white border border-[var(--border)] rounded-sm overflow-x-auto">
              <table className="w-full ledger-table" data-testid="closing-preview-table">
                <thead>
                  <tr>
                    <th className="text-left">Party</th>
                    <th className="text-left">Opening Type</th>
                    <th className="text-right">Gold</th>
                    <th className="text-right">Fine</th>
                    <th className="text-right">Silver</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.parties_with_balance.length ? preview.parties_with_balance.map((p) => (
                    <tr key={p.party_id}>
                      <td className="font-medium">{p.party_name}</td>
                      <td><TypePill type={p.type} /></td>
                      <td className={`text-right ${p.balance.gold < 0 ? "text-[var(--naame)]" : "text-[var(--jama)]"}`}>{fmt(p.balance.gold)}</td>
                      <td className={`text-right ${p.balance.fine_gold < 0 ? "text-[var(--naame)]" : "text-[var(--jama)]"}`}>{fmt(p.balance.fine_gold)}</td>
                      <td className={`text-right ${p.balance.silver < 0 ? "text-[var(--naame)]" : "text-[var(--jama)]"}`}>{fmt(p.balance.silver)}</td>
                      <td className={`text-right font-semibold ${p.balance.amount < 0 ? "text-[var(--naame)]" : "text-[var(--jama)]"}`}>{fmtINR(p.balance.amount)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="text-center text-muted-foreground py-6">No parties have a non-zero balance up to {preview.period}.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-display text-lg font-bold mb-3">Past Closings <span className="font-hindi text-sm text-muted-foreground">पिछले समापन</span></h3>
        <div className="bg-white border border-[var(--border)] rounded-sm shadow-ledger overflow-x-auto">
          <table className="w-full ledger-table" data-testid="closings-history-table">
            <thead>
              <tr>
                <th className="text-left">Period</th>
                <th className="text-left">Opening Date</th>
                <th className="text-right">Entries Created</th>
                <th className="text-right">Skipped (zero bal.)</th>
                <th className="text-left">Run By</th>
                <th className="text-left">Run At</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {closings.length ? closings.map((c) => (
                <tr key={c.id}>
                  <td className="font-semibold">{c.period}</td>
                  <td>{c.opening_date}</td>
                  <td className="text-right">{c.entries_count}</td>
                  <td className="text-right text-muted-foreground">{c.skipped}</td>
                  <td>{c.run_by_name}</td>
                  <td className="text-muted-foreground">{c.run_at ? format(parseISO(c.run_at), "dd MMM yyyy HH:mm") : ""}</td>
                  {isAdmin && (
                    <td className="text-right">
                      <Button variant="outline" size="sm" onClick={() => undoClosing(c.period)} className="text-[var(--naame)] hover:bg-[#f9eaea]" data-testid={`closing-undo-${c.period}`}>
                        <Undo2 className="w-3.5 h-3.5 mr-1" /> Undo
                      </Button>
                    </td>
                  )}
                </tr>
              )) : (
                <tr><td colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-6">No closings run yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Month-End Closing</DialogTitle>
            <DialogDescription>
              This will create {preview?.parties_with_balance?.length || 0} "Opening Balance" entries dated <b>{preview?.opening_date}</b>.
              You can undo this later from the Past Closings list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button className="gold-btn" onClick={runClosing} disabled={busy} data-testid="closing-confirm-run">{busy ? "Running…" : "Yes, run closing"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
