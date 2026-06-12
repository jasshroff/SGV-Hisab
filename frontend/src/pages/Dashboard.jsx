import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, StatCard, fmt, fmtINR, TypePill } from "@/components/Bits";
import { Button } from "@/components/ui/button";
import EntryDialog from "@/components/EntryDialog";
import { format } from "date-fns";
import { Plus } from "lucide-react";

export default function Dashboard() {
  const [today, setToday] = useState(null);
  const [parties, setParties] = useState([]);
  const [open, setOpen] = useState(false);
  const dateStr = format(new Date(), "yyyy-MM-dd");

  const load = async () => {
    const [d, p] = await Promise.all([
      api.get(`/reports/daily?date=${dateStr}`),
      api.get("/parties"),
    ]);
    setToday(d.data);
    setParties(p.data);
  };

  useEffect(() => { load(); }, []);

  const totals = today?.totals || { jama: {}, naame: {}, balance: {} };

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto" data-testid="dashboard-page">
      <PageHeader
        title="Today's Hisab"
        hindi="आज का हिसाब"
        subtitle={format(new Date(), "EEEE, dd MMMM yyyy")}
        actions={
          <Button onClick={() => setOpen(true)} className="gold-btn" data-testid="dashboard-add-entry-button">
            <Plus className="w-4 h-4 mr-1.5" /> New Entry
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Jama Gold" hindi="जमा सोना" value={fmt(totals.jama.gold)} accent="jama" testid="stat-jama-gold" />
        <StatCard label="Naame Gold" hindi="नामे सोना" value={fmt(totals.naame.gold)} accent="naame" testid="stat-naame-gold" />
        <StatCard label="Jama Fine" hindi="जमा फाइन" value={fmt(totals.jama.fine_gold)} accent="jama" />
        <StatCard label="Naame Fine" hindi="नामे फाइन" value={fmt(totals.naame.fine_gold)} accent="naame" />
        <StatCard label="Jama Silver" hindi="जमा चांदी" value={fmt(totals.jama.silver)} accent="jama" />
        <StatCard label="Naame Silver" hindi="नामे चांदी" value={fmt(totals.naame.silver)} accent="naame" />
        <StatCard label="Jama Amount" hindi="जमा रकम" value={fmtINR(totals.jama.amount)} accent="jama" />
        <StatCard label="Naame Amount" hindi="नामे रकम" value={fmtINR(totals.naame.amount)} accent="naame" />
      </div>

      <div className="bg-white border border-[var(--border)] rounded-sm shadow-ledger overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-baseline gap-2">
          <h3 className="font-display text-lg font-bold">Net Balance</h3>
          <span className="font-hindi text-sm text-muted-foreground">शुद्ध शेष</span>
          <span className="ml-auto text-xs text-muted-foreground">Jama − Naame</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--border)]">
          {[
            { l: "Gold (g)", v: fmt(totals.balance?.gold), h: "सोना" },
            { l: "Fine (g)", v: fmt(totals.balance?.fine_gold), h: "फाइन" },
            { l: "Silver (g)", v: fmt(totals.balance?.silver), h: "चांदी" },
            { l: "Amount", v: fmtINR(totals.balance?.amount), h: "रकम" },
          ].map((b, i) => (
            <div key={i} className="px-5 py-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{b.l} <span className="font-hindi normal-case">{b.h}</span></div>
              <div className={`mt-1 font-display text-2xl font-bold tabular-nums ${Number(String(b.v).replace(/[^\d.-]/g,"")) < 0 ? "text-[var(--naame)]" : "text-[var(--jama)]"}`}>{b.v}</div>
            </div>
          ))}
        </div>
      </div>

      <h3 className="font-display text-xl font-bold mb-3">By User <span className="font-hindi text-sm text-muted-foreground">यूज़र अनुसार</span></h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {today?.by_user?.length ? today.by_user.map((u) => (
          <div key={u.user_id} className="bg-white border border-[var(--border)] rounded-sm shadow-ledger" data-testid={`user-card-${u.user_id}`}>
            <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <div className="font-semibold">{u.user_name}</div>
              <div className="text-xs text-muted-foreground">{u.entries.length} entries</div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-[var(--border)]">
              <div className="px-4 py-3">
                <div className="text-[11px] uppercase text-muted-foreground">Jama</div>
                <div className="text-sm tabular-nums">Gold: {fmt(u.totals.jama.gold)}</div>
                <div className="text-sm tabular-nums">Fine: {fmt(u.totals.jama.fine_gold)}</div>
                <div className="text-sm tabular-nums">Amt: {fmtINR(u.totals.jama.amount)}</div>
              </div>
              <div className="px-4 py-3">
                <div className="text-[11px] uppercase text-muted-foreground">Naame</div>
                <div className="text-sm tabular-nums">Gold: {fmt(u.totals.naame.gold)}</div>
                <div className="text-sm tabular-nums">Fine: {fmt(u.totals.naame.fine_gold)}</div>
                <div className="text-sm tabular-nums">Amt: {fmtINR(u.totals.naame.amount)}</div>
              </div>
            </div>
          </div>
        )) : <div className="col-span-2 text-sm text-muted-foreground bg-white border border-dashed border-[var(--border)] rounded-sm p-8 text-center">No entries today. Click <span className="font-medium">New Entry</span> to begin.</div>}
      </div>

      <h3 className="font-display text-xl font-bold mb-3">Today's Entries <span className="font-hindi text-sm text-muted-foreground">आज की एंट्री</span></h3>
      <div className="bg-white border border-[var(--border)] rounded-sm shadow-ledger overflow-x-auto">
        <table className="w-full ledger-table" data-testid="today-entries-table">
          <thead>
            <tr>
              <th className="text-left">Time</th>
              <th className="text-left">User</th>
              <th className="text-left">Party</th>
              <th className="text-left">Item</th>
              <th className="text-left">Type</th>
              <th className="text-right">Gold</th>
              <th className="text-right">Fine</th>
              <th className="text-right">Silver</th>
              <th className="text-right">Touch%</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {today?.entries?.length ? today.entries.map((e) => (
              <tr key={e.id}>
                <td className="text-muted-foreground">{e.created_at ? format(new Date(e.created_at), "HH:mm") : ""}</td>
                <td>{e.created_by_name}</td>
                <td className="font-medium">{e.party_name}</td>
                <td>{e.item_name}</td>
                <td><TypePill type={e.type} /></td>
                <td className="text-right">{fmt(e.gold)}</td>
                <td className="text-right">{fmt(e.fine_gold)}</td>
                <td className="text-right">{fmt(e.silver)}</td>
                <td className="text-right">{fmt(e.touch, 2)}</td>
                <td className={`text-right font-medium ${e.type === "jama" ? "text-[var(--jama)]" : "text-[var(--naame)]"}`}>{fmtINR(e.amount)}</td>
              </tr>
            )) : (
              <tr><td colSpan={10} className="text-center text-muted-foreground py-8">No entries yet today.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <EntryDialog open={open} onOpenChange={setOpen} parties={parties} onSaved={load} />
    </div>
  );
}
