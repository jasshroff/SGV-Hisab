import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Coins } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await register(name, email, password);
    setBusy(false);
    if (r.ok) navigate("/");
    else setErr(r.error);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg)] bg-bahi">
      <div className="w-full max-w-sm bg-white border border-[var(--border)] rounded-sm shadow-ledger p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-sm bg-gradient-to-br from-[#d4af37] to-[#b38c3b] flex items-center justify-center text-white">
            <Coins className="w-5 h-5" />
          </div>
          <div className="font-display font-bold text-[15px] leading-tight">Shree Gopaldas Vallabhdas</div>
        </div>
        <h2 className="font-display text-2xl font-bold">Create account</h2>
        <p className="text-sm text-muted-foreground mt-1"><span className="font-hindi">नया खाता बनाएँ</span></p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="name">Name <span className="font-hindi text-xs text-muted-foreground">(नाम)</span></Label>
            <Input id="name" data-testid="register-name-input" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" data-testid="register-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="password">Password (min 6)</Label>
            <Input id="password" data-testid="register-password-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1.5" />
          </div>
          {err && <div className="text-sm text-[#8e2e2e] bg-[#f9eaea] border border-[#ecc8c8] px-3 py-2 rounded-sm" data-testid="register-error">{err}</div>}
          <Button type="submit" disabled={busy} data-testid="register-submit-button" className="w-full gold-btn">
            {busy ? "Creating…" : "Create account"}
          </Button>
        </form>

        <div className="text-sm text-muted-foreground mt-6">
          Have an account? <Link to="/login" className="text-[#b38c3b] font-medium hover:underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
