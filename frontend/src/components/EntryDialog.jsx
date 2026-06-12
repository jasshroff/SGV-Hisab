import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { CalendarIcon, Check, ChevronsUpDown, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";
import api, { formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const blank = {
  date: format(new Date(), "yyyy-MM-dd"),
  party_id: "",
  item_name: "",
  type: "jama",
  gold: "",
  fine_gold: "",
  silver: "",
  touch: "",
  amount: "",
  remarks: "",
};

function PartyCombobox({ parties, value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = parties.find((p) => p.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal mt-1.5"
          data-testid="entry-party-combobox"
        >
          {selected ? selected.name : "Search or select party…"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Type party name…" data-testid="party-combobox-input" />
          <CommandList>
            <CommandEmpty>No party found.</CommandEmpty>
            <CommandGroup>
              {parties.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.name}
                  onSelect={() => { onChange(p.id); setOpen(false); }}
                  data-testid={`party-option-${p.id}`}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span className="font-medium">{p.name}</span>
                    {p.phone && <span className="text-xs text-muted-foreground">{p.phone}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function EntryDialog({ open, onOpenChange, parties, editEntry, onSaved }) {
  const [form, setForm] = useState(blank);
  const [fineEdited, setFineEdited] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      if (editEntry) {
        setForm({
          date: editEntry.date,
          party_id: editEntry.party_id,
          item_name: editEntry.item_name,
          type: editEntry.type,
          gold: editEntry.gold || "",
          fine_gold: editEntry.fine_gold || "",
          silver: editEntry.silver || "",
          touch: editEntry.touch || "",
          amount: editEntry.amount || "",
          remarks: editEntry.remarks || "",
        });
        setFineEdited(true); // existing entries: keep user's stored fine gold as-is
      } else {
        setForm({ ...blank, date: format(new Date(), "yyyy-MM-dd") });
        setFineEdited(false);
      }
    }
  }, [open, editEntry]);

  const setField = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  // Auto-calc Fine Gold = Gold × Touch% / 100 (only when user hasn't manually overridden)
  const autoFine = useMemo(() => {
    const g = parseFloat(form.gold);
    const t = parseFloat(form.touch);
    if (!isNaN(g) && !isNaN(t) && g > 0 && t > 0) {
      return (g * t / 100).toFixed(3);
    }
    return null;
  }, [form.gold, form.touch]);

  useEffect(() => {
    if (!fineEdited && autoFine !== null) {
      setForm((f) => ({ ...f, fine_gold: autoFine }));
    }
  }, [autoFine, fineEdited]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.party_id) { toast.error("Please select a party"); return; }
    if (!form.item_name.trim()) { toast.error("Item name is required"); return; }
    setBusy(true);
    try {
      const payload = {
        ...form,
        gold: parseFloat(form.gold || 0),
        fine_gold: parseFloat(form.fine_gold || 0),
        silver: parseFloat(form.silver || 0),
        touch: parseFloat(form.touch || 0),
        amount: parseFloat(form.amount || 0),
      };
      if (editEntry) await api.put(`/entries/${editEntry.id}`, payload);
      else await api.post("/entries", payload);
      toast.success(editEntry ? "Entry updated" : "Entry added");
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="entry-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {editEntry ? "Edit Entry" : "New Entry"} <span className="font-hindi text-base text-muted-foreground ml-2">{editEntry ? "एंट्री संपादित करें" : "नई एंट्री"}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">Add or edit a Jama / Naame ledger entry with party, item, gold, fine, silver, touch, amount and remarks.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div>
            <Label>Date <span className="font-hindi text-xs text-muted-foreground">(दिनांक)</span></Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-start mt-1.5 font-normal" data-testid="entry-date-button">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {form.date ? format(parseISO(form.date), "dd MMM yyyy") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar mode="single" selected={form.date ? parseISO(form.date) : new Date()}
                  onSelect={(d) => d && setField("date")(format(d, "yyyy-MM-dd"))} />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>Type <span className="font-hindi text-xs text-muted-foreground">(प्रकार)</span></Label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <button type="button" onClick={() => setField("type")("jama")}
                data-testid="entry-type-jama"
                className={`px-3 py-2 rounded-sm text-sm font-semibold border transition-colors ${
                  form.type === "jama" ? "bg-[var(--jama-bg)] border-[#cfe3cb] text-[var(--jama)]" : "bg-white border-[var(--border)] text-muted-foreground"
                }`}>
                JAMA <span className="font-hindi font-normal">जमा</span>
              </button>
              <button type="button" onClick={() => setField("type")("naame")}
                data-testid="entry-type-naame"
                className={`px-3 py-2 rounded-sm text-sm font-semibold border transition-colors ${
                  form.type === "naame" ? "bg-[var(--naame-bg)] border-[#ecc8c8] text-[var(--naame)]" : "bg-white border-[var(--border)] text-muted-foreground"
                }`}>
                NAAME <span className="font-hindi font-normal">नामे</span>
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <Label>Party <span className="font-hindi text-xs text-muted-foreground">(पार्टी)</span></Label>
            <PartyCombobox parties={parties} value={form.party_id} onChange={setField("party_id")} />
          </div>

          <div className="md:col-span-2">
            <Label>Item <span className="font-hindi text-xs text-muted-foreground">(वस्तु)</span></Label>
            <Input value={form.item_name} onChange={(e) => setField("item_name")(e.target.value)} placeholder="e.g., 22K Bangles, Bar, Coins" className="mt-1.5" data-testid="entry-item-input" />
          </div>

          <div>
            <Label>Gold (g) <span className="font-hindi text-xs text-muted-foreground">(सोना)</span></Label>
            <Input type="number" step="0.001" value={form.gold} onChange={(e) => setField("gold")(e.target.value)} className="mt-1.5 tabular-nums" data-testid="entry-gold-input" />
          </div>
          <div>
            <Label>Touch % <span className="font-hindi text-xs text-muted-foreground">(टच)</span></Label>
            <Input type="number" step="0.01" value={form.touch} onChange={(e) => setField("touch")(e.target.value)} className="mt-1.5 tabular-nums" data-testid="entry-touch-input" />
          </div>
          <div className="md:col-span-2">
            <div className="flex items-center justify-between">
              <Label>Fine Gold (g) <span className="font-hindi text-xs text-muted-foreground">(फाइन)</span></Label>
              {!fineEdited && autoFine !== null && (
                <span className="text-[11px] text-[#b38c3b] inline-flex items-center gap-1"><Sparkles className="w-3 h-3" /> auto = Gold × Touch ÷ 100</span>
              )}
              {fineEdited && (
                <button type="button" onClick={() => { setFineEdited(false); }} className="text-[11px] text-[#b38c3b] hover:underline" data-testid="entry-fine-reset">Reset auto</button>
              )}
            </div>
            <Input
              type="number" step="0.001"
              value={form.fine_gold}
              onChange={(e) => { setFineEdited(true); setField("fine_gold")(e.target.value); }}
              className="mt-1.5 tabular-nums"
              data-testid="entry-fine-input"
            />
          </div>
          <div>
            <Label>Silver (g) <span className="font-hindi text-xs text-muted-foreground">(चांदी)</span></Label>
            <Input type="number" step="0.001" value={form.silver} onChange={(e) => setField("silver")(e.target.value)} className="mt-1.5 tabular-nums" data-testid="entry-silver-input" />
          </div>
          <div>
            <Label>Amount (₹) <span className="font-hindi text-xs text-muted-foreground">(रकम)</span></Label>
            <Input type="number" step="0.01" value={form.amount} onChange={(e) => setField("amount")(e.target.value)} className="mt-1.5 tabular-nums" data-testid="entry-amount-input" />
          </div>
          <div className="md:col-span-2">
            <Label>Remarks <span className="font-hindi text-xs text-muted-foreground">(टिप्पणी)</span></Label>
            <Textarea value={form.remarks} onChange={(e) => setField("remarks")(e.target.value)} className="mt-1.5" rows={2} data-testid="entry-remarks-input" />
          </div>

          <DialogFooter className="md:col-span-2 mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="entry-cancel-button">Cancel</Button>
            <Button type="submit" disabled={busy} className="gold-btn" data-testid="entry-save-button">{busy ? "Saving…" : "Save Entry"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
