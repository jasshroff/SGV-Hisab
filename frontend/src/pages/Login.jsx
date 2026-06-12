import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Coins } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await login(email, password);
    setBusy(false);
    if (r.ok) navigate("/");
    else setErr(r.error);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <div
        className="hidden lg:flex flex-col justify-between p-12 text-white relative"
        style={{
          backgroundImage:
            "linear-gradient(rgba(26,28,25,0.75), rgba(26,28,25,0.85)), url('https://images.unsplash.com/photo-1753785945213-d562c9c953ae?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwxfHx0cmFkaXRpb25hbCUyMEluZGlhbiUyMHBhdHRlcm58ZW58MHx8fHwxNzgxMTc1OTUyfDA&ixlib=rb-4.1.0&q=85')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-sm bg-gradient-to-br from-[#d4af37] to-[#b38c3b] flex items-center justify-center">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <div className="font-display font-bold text-lg leading-tight">Shree Gopaldas Vallabhdas</div>
            <div className="text-xs text-[#d4c39a]">Jewellers · Established Trust</div>
          </div>
        </div>
        <div>
          <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight">
            B2B Hisab,<br />
            kept simple.
          </h1>
          <p className="font-hindi text-[#d4c39a] text-base mt-3">सोना, फाइन, चांदी · जमा-नामे का सटीक हिसाब</p>
          <p className="text-sm text-[#cfcfc5] mt-4 max-w-md">
            A modern digital Bahi-Khata for two users to record Jama & Naame entries party-wise, with daily reconciliation and clean exports.
          </p>
        </div>
        <div className="text-[11px] text-[#a8a89e]">© {new Date().getFullYear()} Shree Gopaldas Vallabhdas Jewellers</div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-3xl font-bold">Welcome back</h2>
          <p className="text-sm text-muted-foreground mt-1">Sign in to continue · <span className="font-hindi">लॉगिन करें</span></p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email">Email <span className="font-hindi text-xs text-muted-foreground">(ईमेल)</span></Label>
              <Input id="email" data-testid="login-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="password">Password <span className="font-hindi text-xs text-muted-foreground">(पासवर्ड)</span></Label>
              <Input id="password" data-testid="login-password-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1.5" />
            </div>
            {err && <div className="text-sm text-[#8e2e2e] bg-[#f9eaea] border border-[#ecc8c8] px-3 py-2 rounded-sm" data-testid="login-error">{err}</div>}
            <Button type="submit" disabled={busy} data-testid="login-submit-button" className="w-full gold-btn">
              {busy ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <div className="text-sm text-muted-foreground mt-6">
            New user? <Link to="/register" data-testid="register-link" className="text-[#b38c3b] font-medium hover:underline">Create account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
