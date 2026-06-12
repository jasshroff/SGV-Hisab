import React from "react";

export function PageHeader({ title, hindi, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
      <div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[var(--ink)]">{title}</h1>
          {hindi && <span className="font-hindi text-sm sm:text-base text-muted-foreground">{hindi}</span>}
        </div>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, hindi, value, accent = "default", testid }) {
  const colors = {
    default: "text-[var(--ink)]",
    jama: "text-[var(--jama)]",
    naame: "text-[var(--naame)]",
    gold: "text-[#b38c3b]",
  };
  return (
    <div className="bg-white border border-[var(--border)] rounded-sm p-5 shadow-ledger" data-testid={testid}>
      <div className="flex items-baseline gap-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
        {hindi && <div className="font-hindi text-[11px] text-muted-foreground">{hindi}</div>}
      </div>
      <div className={`mt-2 font-display text-3xl font-bold tabular-nums ${colors[accent]}`}>{value}</div>
    </div>
  );
}

export const fmt = (n, dec = 3) =>
  Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const fmtINR = (n) =>
  "₹ " + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function TypePill({ type }) {
  if (type === "jama")
    return <span className="px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide jama-pill rounded-sm">Jama <span className="font-hindi font-normal">जमा</span></span>;
  return <span className="px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide naame-pill rounded-sm">Naame <span className="font-hindi font-normal">नामे</span></span>;
}
