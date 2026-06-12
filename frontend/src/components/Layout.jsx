import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, BookOpen, Users, FileBarChart2, Shield, LogOut, Coins, DatabaseBackup, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NavItem = ({ to, icon: Icon, label, hindi, testid, onClick }) => (
  <NavLink
    to={to}
    end
    onClick={onClick}
    data-testid={testid}
    className={({ isActive }) =>
      `flex items-center gap-3 px-4 py-2.5 rounded-sm text-sm transition-colors ${
        isActive
          ? "bg-[#f5ebd2] text-[#1a1c19] border-l-2 border-[#c89e47]"
          : "text-[#5c5f5a] hover:bg-[#f3f1ea] border-l-2 border-transparent"
      }`
    }
  >
    <Icon className="w-4 h-4" />
    <span className="font-medium">{label}</span>
    <span className="font-hindi text-[11px] text-muted-foreground ml-auto">{hindi}</span>
  </NavLink>
);

function SidebarContent({ onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-sm bg-gradient-to-br from-[#d4af37] to-[#b38c3b] flex items-center justify-center text-white">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <div className="font-display font-bold text-[15px] leading-tight">Shree Gopaldas</div>
            <div className="text-[11px] text-muted-foreground">Vallabhdas Jewellers</div>
          </div>
        </div>
        <div className="font-hindi text-[11px] text-muted-foreground mt-2">श्री गोपालदास वल्लभदास ज्वेलर्स</div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <NavItem to="/" icon={LayoutDashboard} label="Dashboard" hindi="डैशबोर्ड" testid="nav-dashboard" onClick={onNavigate} />
        <NavItem to="/entries" icon={BookOpen} label="Entries" hindi="बही" testid="nav-entries" onClick={onNavigate} />
        <NavItem to="/parties" icon={Users} label="Parties" hindi="पार्टी" testid="nav-parties" onClick={onNavigate} />
        <NavItem to="/reports" icon={FileBarChart2} label="Reports" hindi="रिपोर्ट" testid="nav-reports" onClick={onNavigate} />
        {user?.role === "admin" && (
          <NavItem to="/backup" icon={DatabaseBackup} label="Backup" hindi="बैकअप" testid="nav-backup" onClick={onNavigate} />
        )}
        {user?.role === "admin" && (
          <NavItem to="/admin" icon={Shield} label="Admin" hindi="व्यवस्थापक" testid="nav-admin" onClick={onNavigate} />
        )}
      </nav>

      <div className="p-3 border-t border-[var(--border)]">
        <div className="px-3 py-2">
          <div className="text-sm font-medium truncate" data-testid="user-name">{user?.name}</div>
          <div className="text-[11px] text-muted-foreground truncate">{user?.email}</div>
          <div className="text-[10px] mt-1 inline-block px-1.5 py-0.5 rounded-sm bg-[#f5ebd2] text-[#8a6b1f] uppercase tracking-wide">
            {user?.role}
          </div>
        </div>
        <button
          onClick={async () => { onNavigate?.(); await logout(); navigate("/login"); }}
          data-testid="logout-button"
          className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 text-sm text-[#5c5f5a] hover:bg-[#f3f1ea] rounded-sm transition-colors"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-[var(--bg)] bg-bahi">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-[var(--border)] flex-col flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-[var(--border)] h-14 flex items-center justify-between px-4 no-print">
        <div className="flex items-center gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button className="p-2 -ml-2 rounded-sm hover:bg-[#f3f1ea]" data-testid="mobile-menu-button" aria-label="Open menu">
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SidebarContent onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-sm bg-gradient-to-br from-[#d4af37] to-[#b38c3b] flex items-center justify-center text-white">
              <Coins className="w-4 h-4" />
            </div>
            <div className="font-display font-bold text-sm leading-tight">Shree Gopaldas</div>
          </div>
        </div>
      </div>

      <main className="flex-1 min-w-0 pt-14 lg:pt-0">{children}</main>
    </div>
  );
}
