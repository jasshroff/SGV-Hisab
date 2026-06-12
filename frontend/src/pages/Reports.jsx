import React, { useEffect, useState } from "react";
import api, { API } from "@/lib/api";
import { PageHeader, StatCard, fmt, fmtINR, TypePill } from "@/components/Bits";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Download } from "lucide-react";
import { format, parseISO } from "date-fns";

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

export default function Reports() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [daily, setDaily] = useState(null);
  const [balances, setBalances] = useState([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  useEffect(() => {
    (async () => {
      const d = await api.get(`/reports/daily?date=${date}`);
      setDaily(d.data);
    })();
  }, [date]);

  useEffect(() => {
    (async () => {
      const b = await api.get("/reports/party-balances");
      setBalances(b.data);
    })();
  }, []);

  const exportRange = async () => {
    const q = new URLSearchParams();
    if (start) q.append("start_date", start);
    if (end) q.append("end_date", end);
    const token = localStorage.getItem("access_token");
    const r = await fetch(`${API}/reports/export?${q.toString()}`, {
      credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hisab_${start || "all"}_${end || "all"}.xlsx`;
    a.click();
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto" data-testid="reports-page">
      <PageHeader title="Reports" hindi="रिपोर्ट" subtitle="Daily summary, party balances & exports" />

      <Tabs defaultValue="daily">
        <TabsList className="bg-transparent border-b border-[var(--border)] w-full justify-start rounded-none p-0 h-auto">
          <TabsTrigger value="daily" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#c89e47] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2" data-testid="tab-daily">Daily Hisab</TabsTrigger>
          <TabsTrigger value="parties" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#c89e47] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2" data-testid="tab-party-balances">Party Balances</TabsTrigger>
          <TabsTrigger value="export" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#c89e47] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2" data-testid="tab-export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-6">
          <div className="flex items-end gap-3 mb-5">
            <div className="w-64">
              <Label className="text-xs">Date</Label>
              <div className="mt-1.5"><DateButton value={date} onChange={setDate} placeholder="Select date" testid="report-date" /></div>
            </div>
          </div>

          {daily && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard label="Net Gold" hindi="शुद्ध सोना" value={fmt(daily.totals.balance.gold)} accent={daily.totals.balance.gold >= 0 ? "jama" : "naame"} />
                <StatCard label="Net Fine" hindi="शुद्ध फाइन" value={fmt(daily.totals.balance.fine_gold)} accent={daily.totals.balance.fine_gold >= 0 ? "jama" : "naame"} />
                <StatCard label="Net Silver" hindi="शुद्ध चांदी" value={fmt(daily.totals.balance.silver)} accent={daily.totals.balance.silver >= 0 ? "jama" : "naame"} />
                <StatCard label="Net Amount" hindi="शुद्ध रकम" value={fmtINR(daily.totals.balance.amount)} accent={daily.totals.balance.amount >= 0 ? "jama" : "naame"} />
              </div>

              <h3 className="font-display text-xl font-bold mb-3">User-wise comparison <span className="font-hindi text-sm text-muted-foreground">यूज़र अनुसार तुलना</span></h3>
              <div className="overflow-x-auto bg-white border border-[var(--border)] rounded-sm shadow-ledger mb-8">
                <table className="w-full ledger-table">
                  <thead>
                    <tr>
                      <th className="text-left">User</th>
                      <th className="text-right">Jama Gold</th>
                      <th className="text-right">Naame Gold</th>
                      <th className="text-right">Jama Fine</th>
                      <th className="text-right">Naame Fine</th>
                      <th className="text-right">Jama Amount</th>
                      <th className="text-right">Naame Amount</th>
                      <th className="text-right">Entries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daily.by_user.length ? daily.by_user.map((u) => (
                      <tr key={u.user_id}>
                        <td className="font-medium">{u.user_name}</td>
                        <td className="text-right text-[var(--jama)]">{fmt(u.totals.jama.gold)}</td>
                        <td className="text-right text-[var(--naame)]">{fmt(u.totals.naame.gold)}</td>
                        <td className="text-right text-[var(--jama)]">{fmt(u.totals.jama.fine_gold)}</td>
                        <td className="text-right text-[var(--naame)]">{fmt(u.totals.naame.fine_gold)}</td>
                        <td className="text-right text-[var(--jama)]">{fmtINR(u.totals.jama.amount)}</td>
                        <td className="text-right text-[var(--naame)]">{fmtINR(u.totals.naame.amount)}</td>
                        <td className="text-right">{u.entries.length}</td>
                      </tr>
                    )) : <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">No entries on this date.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="parties" className="mt-6">
          <div className="bg-white border border-[var(--border)] rounded-sm shadow-ledger overflow-x-auto">
            <table className="w-full ledger-table" data-testid="party-balances-table">
              <thead>
                <tr>
                  <th className="text-left">Party</th>
                  <th className="text-right">Jama Gold</th>
                  <th className="text-right">Naame Gold</th>
                  <th className="text-right">Bal. Gold</th>
                  <th className="text-right">Bal. Fine</th>
                  <th className="text-right">Bal. Silver</th>
                  <th className="text-right">Bal. Amount</th>
                </tr>
              </thead>
              <tbody>
                {balances.length ? balances.map((b) => (
                  <tr key={b.party_id}>
                    <td className="font-medium">{b.party_name}</td>
                    <td className="text-right text-[var(--jama)]">{fmt(b.jama.gold)}</td>
                    <td className="text-right text-[var(--naame)]">{fmt(b.naame.gold)}</td>
                    <td className={`text-right font-semibold ${b.balance.gold < 0 ? "text-[var(--naame)]" : "text-[var(--jama)]"}`}>{fmt(b.balance.gold)}</td>
                    <td className={`text-right font-semibold ${b.balance.fine_gold < 0 ? "text-[var(--naame)]" : "text-[var(--jama)]"}`}>{fmt(b.balance.fine_gold)}</td>
                    <td className={`text-right font-semibold ${b.balance.silver < 0 ? "text-[var(--naame)]" : "text-[var(--jama)]"}`}>{fmt(b.balance.silver)}</td>
                    <td className={`text-right font-semibold ${b.balance.amount < 0 ? "text-[var(--naame)]" : "text-[var(--jama)]"}`}>{fmtINR(b.balance.amount)}</td>
                  </tr>
                )) : <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">No party data yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="export" className="mt-6">
          <div className="bg-white border border-[var(--border)] rounded-sm shadow-ledger p-6 max-w-2xl">
            <h3 className="font-display text-lg font-bold mb-1">Excel Export</h3>
            <p className="text-sm text-muted-foreground mb-5">Pick a date range to download all entries with totals.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label className="text-xs">From</Label><div className="mt-1.5"><DateButton value={start} onChange={setStart} placeholder="Start date" testid="export-start" /></div></div>
              <div><Label className="text-xs">To</Label><div className="mt-1.5"><DateButton value={end} onChange={setEnd} placeholder="End date" testid="export-end" /></div></div>
            </div>
            <Button onClick={exportRange} className="gold-btn mt-5" data-testid="export-button"><Download className="w-4 h-4 mr-1.5" /> Download Excel</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
