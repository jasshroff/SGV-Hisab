import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { API } from "@/lib/api";
import { PageHeader, fmt, fmtINR, TypePill, StatCard, OpeningBadge } from "@/components/Bits";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Download, ArrowLeft, Printer, Share2 } from "lucide-react";
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

export default function PartyLedger() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const load = async () => {
    const q = new URLSearchParams();
    if (start) q.append("start_date", start);
    if (end) q.append("end_date", end);
    const r = await api.get(`/reports/party/${id}?${q.toString()}`);
    setData(r.data);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, start, end]);

  const exportXl = async () => {
    const q = new URLSearchParams();
    q.append("party_id", id);
    if (start) q.append("start_date", start);
    if (end) q.append("end_date", end);
    const token = localStorage.getItem("access_token");
    const r = await fetch(`${API}/reports/export?${q.toString()}`, {
      credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `party_${data?.party?.name || id}.xlsx`;
    a.click();
  };

  const sanitizePhone = (p) => {
    if (!p) return "";
    let d = String(p).replace(/[^\d]/g, "");
    if (d.length === 10) d = "91" + d; // assume India if 10-digit
    return d;
  };

  const fmtN = (n, dec = 3) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const fmtR = (n) => "Rs. " + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const buildWhatsAppMessage = () => {
    if (!data) return "";
    const t = data.totals;
    const range = start && end ? `${format(parseISO(start), "dd MMM yyyy")} to ${format(parseISO(end), "dd MMM yyyy")}`
                : start ? `From ${format(parseISO(start), "dd MMM yyyy")}`
                : end ? `Up to ${format(parseISO(end), "dd MMM yyyy")}` : "All entries";
    const lines = [
      "*Shree Gopaldas Vallabhdas Jewellers*",
      "श्री गोपालदास वल्लभदास ज्वेलर्स",
      "",
      `*Party Statement:* ${data.party.name}`,
      `*Period:* ${range}`,
      `*Entries:* ${data.entries.length}`,
      "",
      "*Jama (जमा)*",
      `Gold: ${fmtN(t.jama.gold)} g · Fine: ${fmtN(t.jama.fine_gold)} g`,
      `Silver: ${fmtN(t.jama.silver)} g · Amount: ${fmtR(t.jama.amount)}`,
      "",
      "*Naame (नामे)*",
      `Gold: ${fmtN(t.naame.gold)} g · Fine: ${fmtN(t.naame.fine_gold)} g`,
      `Silver: ${fmtN(t.naame.silver)} g · Amount: ${fmtR(t.naame.amount)}`,
      "",
      "*Net Balance (Jama − Naame)*",
      `Gold: ${fmtN(t.balance.gold)} g`,
      `Fine: ${fmtN(t.balance.fine_gold)} g`,
      `Silver: ${fmtN(t.balance.silver)} g`,
      `Amount: ${fmtR(t.balance.amount)}`,
      "",
      `Generated: ${format(new Date(), "dd MMM yyyy")}`,
    ];
    return lines.join("\n");
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(buildWhatsAppMessage());
    const phone = sanitizePhone(data?.party?.phone);
    const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!data) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  const t = data.totals;
  const dateRangeText = start && end ? `${format(parseISO(start), "dd MMM yyyy")} – ${format(parseISO(end), "dd MMM yyyy")}` : (start ? `From ${format(parseISO(start), "dd MMM yyyy")}` : (end ? `Up to ${format(parseISO(end), "dd MMM yyyy")}` : "All entries"));

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto" data-testid="party-ledger-page">
      <div className="print-header mb-6 pb-4 border-b-2 border-[#c89e47]">
        <div className="text-center">
          <div className="font-display text-2xl font-black">Shree Gopaldas Vallabhdas Jewellers</div>
          <div className="font-hindi text-sm">श्री गोपालदास वल्लभदास ज्वेलर्स</div>
          <div className="text-base font-semibold mt-3">Party Statement · {data.party.name}</div>
          <div className="text-xs text-muted-foreground mt-1">{dateRangeText} · Generated {format(new Date(), "dd MMM yyyy")}</div>
        </div>
      </div>

      <div className="no-print">
      <Link to="/parties" className="text-sm text-muted-foreground hover:text-[var(--ink)] inline-flex items-center gap-1 mb-3"><ArrowLeft className="w-4 h-4" /> Back to Parties</Link>
      <PageHeader
        title={data.party.name}
        hindi="पार्टी का खाता"
        subtitle={[data.party.phone, data.party.address].filter(Boolean).join(" · ") || "Party ledger statement"}
        actions={
          <>
            <Button variant="outline" onClick={shareWhatsApp} data-testid="ledger-whatsapp-button" className="text-[#128c7e] hover:text-[#128c7e] hover:bg-[#e7f6f3] border-[#128c7e]/30"><Share2 className="w-4 h-4 mr-1.5" /> WhatsApp</Button>
            <Button variant="outline" onClick={() => window.print()} data-testid="ledger-print-button"><Printer className="w-4 h-4 mr-1.5" /> Print / PDF</Button>
            <Button variant="outline" onClick={exportXl} data-testid="ledger-export-button"><Download className="w-4 h-4 mr-1.5" /> Excel</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
        <div>
          <Label className="text-xs">From</Label>
          <div className="mt-1.5"><DateButton value={start} onChange={setStart} placeholder="Start" testid="ledger-start" /></div>
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <div className="mt-1.5"><DateButton value={end} onChange={setEnd} placeholder="End" testid="ledger-end" /></div>
        </div>
        <div className="flex items-end"><Button variant="outline" className="w-full" onClick={() => { setStart(""); setEnd(""); }}>Clear filters</Button></div>
      </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Net Gold" hindi="शुद्ध सोना" value={fmt(t.balance.gold)} accent={t.balance.gold >= 0 ? "jama" : "naame"} />
        <StatCard label="Net Fine" hindi="शुद्ध फाइन" value={fmt(t.balance.fine_gold)} accent={t.balance.fine_gold >= 0 ? "jama" : "naame"} />
        <StatCard label="Net Silver" hindi="शुद्ध चांदी" value={fmt(t.balance.silver)} accent={t.balance.silver >= 0 ? "jama" : "naame"} />
        <StatCard label="Net Amount" hindi="शुद्ध रकम" value={fmtINR(t.balance.amount)} accent={t.balance.amount >= 0 ? "jama" : "naame"} />
      </div>

      <div className="bg-white border border-[var(--border)] rounded-sm shadow-ledger overflow-x-auto">
        <table className="w-full ledger-table" data-testid="party-ledger-table">
          <thead>
            <tr>
              <th className="text-left">Date</th>
              <th className="text-left">Item</th>
              <th className="text-left">Type</th>
              <th className="text-right">Gold</th>
              <th className="text-right">Fine</th>
              <th className="text-right">Silver</th>
              <th className="text-right">Amount</th>
              <th className="text-right">Bal. Gold</th>
              <th className="text-right">Bal. Fine</th>
              <th className="text-right">Bal. Amount</th>
              <th className="text-left">By</th>
            </tr>
          </thead>
          <tbody>
            {data.entries.length ? data.entries.map((e) => (
              <tr key={e.id}>
                <td>{format(parseISO(e.date), "dd MMM yyyy")}</td>
                <td>{e.item_name}{e.is_opening && <OpeningBadge />}</td>
                <td><TypePill type={e.type} /></td>
                <td className="text-right">{fmt(e.gold)}</td>
                <td className="text-right">{fmt(e.fine_gold)}</td>
                <td className="text-right">{fmt(e.silver)}</td>
                <td className={`text-right ${e.type === "jama" ? "text-[var(--jama)]" : "text-[var(--naame)]"}`}>{fmtINR(e.amount)}</td>
                <td className={`text-right font-medium ${e.running_balance.gold < 0 ? "text-[var(--naame)]" : ""}`}>{fmt(e.running_balance.gold)}</td>
                <td className={`text-right font-medium ${e.running_balance.fine_gold < 0 ? "text-[var(--naame)]" : ""}`}>{fmt(e.running_balance.fine_gold)}</td>
                <td className={`text-right font-medium ${e.running_balance.amount < 0 ? "text-[var(--naame)]" : ""}`}>{fmtINR(e.running_balance.amount)}</td>
                <td className="text-xs text-muted-foreground">{e.created_by_name}</td>
              </tr>
            )) : (
              <tr><td colSpan={11} className="text-center text-muted-foreground py-8">No entries for this party.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
