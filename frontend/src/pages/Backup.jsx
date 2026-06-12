import React, { useRef, useState } from "react";
import api, { API, formatApiErrorDetail } from "@/lib/api";
import { PageHeader } from "@/components/Bits";
import { Button } from "@/components/ui/button";
import { Download, Upload, FileSpreadsheet, Database, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

function downloadAuthed(path, filename) {
  const token = localStorage.getItem("access_token");
  return fetch(`${API}${path}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then(async (r) => {
    if (!r.ok) throw new Error("Download failed");
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  });
}

function UploadCard({ title, hindi, endpoint, sampleHeader, testid }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please pick a .csv file"); return;
    }
    upload(f);
    e.target.value = "";
  };

  const upload = async (file) => {
    setBusy(true); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post(endpoint, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setResult(r.data);
      toast.success(`Imported ${r.data.created} rows`);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-[var(--border)] rounded-sm shadow-ledger p-5" data-testid={`${testid}-card`}>
      <div className="flex items-center gap-2">
        <Upload className="w-4 h-4 text-[#b38c3b]" />
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <span className="font-hindi text-sm text-muted-foreground">{hindi}</span>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        CSV headers required: <code className="text-[11px] bg-[#f3f1ea] px-1 py-0.5 rounded-sm">{sampleHeader}</code>
      </div>
      <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onPick} data-testid={`${testid}-file-input`} />
      <Button onClick={() => inputRef.current?.click()} disabled={busy} className="gold-btn mt-4" data-testid={`${testid}-button`}>
        <Upload className="w-4 h-4 mr-1.5" /> {busy ? "Importing…" : "Choose CSV file"}
      </Button>
      {result && (
        <div className="mt-4 text-sm bg-[#eaf4e8] border border-[#cfe3cb] text-[var(--jama)] px-3 py-2 rounded-sm">
          Created {result.created} {result.skipped !== undefined ? `· Skipped ${result.skipped}` : ""}
          {result.errors?.length > 0 && (
            <div className="mt-2 text-[var(--naame)]">
              {result.errors.length} error(s): {result.errors.slice(0, 3).join("; ")}{result.errors.length > 3 ? "…" : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Backup() {
  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto" data-testid="backup-page">
      <PageHeader title="Backup & Restore" hindi="बैकअप" subtitle="Download CSV backups · import entries and parties from CSV" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-[var(--border)] rounded-sm shadow-ledger p-5">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-[#b38c3b]" />
            <h3 className="font-display text-lg font-bold">Download Entries CSV</h3>
            <span className="font-hindi text-sm text-muted-foreground">एंट्री</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">All entries with party name, item, type, gold, fine, silver, touch, amount, remarks.</p>
          <Button variant="outline" className="mt-4" onClick={() => downloadAuthed("/backup/entries.csv", "hisab_entries.csv")} data-testid="download-entries-csv"><FileSpreadsheet className="w-4 h-4 mr-1.5" /> Download entries.csv</Button>
        </div>
        <div className="bg-white border border-[var(--border)] rounded-sm shadow-ledger p-5">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#b38c3b]" />
            <h3 className="font-display text-lg font-bold">Download Parties CSV</h3>
            <span className="font-hindi text-sm text-muted-foreground">पार्टी</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">All party master records (name, phone, address, notes).</p>
          <Button variant="outline" className="mt-4" onClick={() => downloadAuthed("/backup/parties.csv", "hisab_parties.csv")} data-testid="download-parties-csv"><FileSpreadsheet className="w-4 h-4 mr-1.5" /> Download parties.csv</Button>
        </div>
      </div>

      <div className="bg-[#f5ebd2] border border-[#e0c789] rounded-sm p-3 mb-4 flex gap-2 text-sm text-[#7a5b1d]">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>Imports are <b>admin-only</b> and <b>additive</b> (existing records are kept). Duplicate party names are skipped. Entry rows missing required fields are reported as errors.</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UploadCard
          title="Import Parties"
          hindi="पार्टी आयात"
          endpoint="/restore/parties.csv"
          sampleHeader="name, phone, address, notes"
          testid="import-parties"
        />
        <UploadCard
          title="Import Entries"
          hindi="एंट्री आयात"
          endpoint="/restore/entries.csv"
          sampleHeader="date, party_name, item_name, type, gold, fine_gold, silver, touch, amount, remarks"
          testid="import-entries"
        />
      </div>
    </div>
  );
}
