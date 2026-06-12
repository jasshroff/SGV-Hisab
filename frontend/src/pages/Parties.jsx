import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { formatApiErrorDetail } from "@/lib/api";
import { PageHeader, fmt, fmtINR } from "@/components/Bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function Parties() {
  const { user } = useAuth();
  const [parties, setParties] = useState([]);
  const [balances, setBalances] = useState([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });

  const load = async () => {
    const [p, b] = await Promise.all([api.get("/parties"), api.get("/reports/party-balances")]);
    setParties(p.data); setBalances(b.data);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEdit(null); setForm({ name: "", phone: "", address: "", notes: "" }); setOpen(true); };
  const openEdit = (p) => { setEdit(p); setForm({ name: p.name, phone: p.phone || "", address: p.address || "", notes: p.notes || "" }); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (edit) await api.put(`/parties/${edit.id}`, form);
      else await api.post("/parties", form);
      toast.success(edit ? "Party updated" : "Party added");
      setOpen(false); load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this party?")) return;
    try { await api.delete(`/parties/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const balanceMap = Object.fromEntries(balances.map((b) => [b.party_id, b]));

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto" data-testid="parties-page">
      <PageHeader title="Parties" hindi="पार्टी" subtitle="Customers & suppliers ledger"
        actions={<Button className="gold-btn" onClick={openNew} data-testid="party-new-button"><Plus className="w-4 h-4 mr-1.5" /> New Party</Button>}
      />

      <div className="bg-white border border-[var(--border)] rounded-sm shadow-ledger overflow-x-auto">
        <table className="w-full ledger-table" data-testid="parties-table">
          <thead>
            <tr>
              <th className="text-left">Party Name</th>
              <th className="text-left">Phone</th>
              <th className="text-right">Bal. Gold (g)</th>
              <th className="text-right">Bal. Fine (g)</th>
              <th className="text-right">Bal. Silver (g)</th>
              <th className="text-right">Bal. Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {parties.length ? parties.map((p) => {
              const b = balanceMap[p.id]?.balance;
              return (
                <tr key={p.id}>
                  <td className="font-medium">
                    <Link to={`/parties/${p.id}`} className="hover:underline text-[#1a1c19]" data-testid={`party-link-${p.id}`}>
                      {p.name} <ChevronRight className="inline w-3.5 h-3.5 text-muted-foreground" />
                    </Link>
                  </td>
                  <td className="text-muted-foreground">{p.phone || "—"}</td>
                  <td className={`text-right tabular-nums ${(b?.gold ?? 0) < 0 ? "text-[var(--naame)]" : "text-[var(--jama)]"}`}>{fmt(b?.gold ?? 0)}</td>
                  <td className={`text-right tabular-nums ${(b?.fine_gold ?? 0) < 0 ? "text-[var(--naame)]" : "text-[var(--jama)]"}`}>{fmt(b?.fine_gold ?? 0)}</td>
                  <td className={`text-right tabular-nums ${(b?.silver ?? 0) < 0 ? "text-[var(--naame)]" : "text-[var(--jama)]"}`}>{fmt(b?.silver ?? 0)}</td>
                  <td className={`text-right font-semibold tabular-nums ${(b?.amount ?? 0) < 0 ? "text-[var(--naame)]" : "text-[var(--jama)]"}`}>{fmtINR(b?.amount ?? 0)}</td>
                  <td className="text-right whitespace-nowrap">
                    <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-[#f3f1ea] rounded-sm" data-testid={`party-edit-${p.id}`}><Pencil className="w-3.5 h-3.5" /></button>
                    {user?.role === "admin" && (
                      <button onClick={() => del(p.id)} className="p-1.5 hover:bg-[#f9eaea] rounded-sm text-[var(--naame)]" data-testid={`party-delete-${p.id}`}><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={7} className="text-center text-muted-foreground py-8">No parties yet. Add your first party.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="party-dialog">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{edit ? "Edit Party" : "New Party"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div><Label>Name <span className="font-hindi text-xs text-muted-foreground">(नाम)</span></Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="mt-1.5" data-testid="party-name-input" /></div>
            <div><Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1.5" data-testid="party-phone-input" /></div>
            <div><Label>Address</Label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className="mt-1.5" data-testid="party-address-input" /></div>
            <div><Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="mt-1.5" /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="gold-btn" data-testid="party-save-button">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
