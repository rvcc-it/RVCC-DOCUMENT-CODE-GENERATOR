"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, FilePlus2, FileText, HelpCircle, History, LogOut, Menu, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";
import { logout } from "@/app/login/actions";

const NAV = [
  { href: "/generator", label: "Generator", icon: FilePlus2, roles: ["admin", "management", "employee"] },
  { href: "/history", label: "History", icon: History, roles: ["admin", "management", "employee"] },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3, roles: ["admin"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
  { href: "/help", label: "Help", icon: HelpCircle, roles: ["admin", "management", "employee"] },
] as const;

function Brand() {
  return (
    <div className="flex items-center gap-3 px-5 py-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
        <FileText className="h-5 w-5 text-white" />
      </div>
      <div className="leading-tight">
        <p className="text-[13px] font-bold tracking-wide text-white">UNIQUE NUMBERING</p>
        <p className="text-[11px] text-blue-200">Document Code Generator</p>
      </div>
    </div>
  );
}

export function AppShell({ role, name, children }: { role: Role; name: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => (n.roles as readonly string[]).includes(role));
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link key={href} href={href} onClick={() => setOpen(false)}
            className={cn("group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
              active ? "bg-white text-brand-800 shadow-lg shadow-blue-950/20" : "text-blue-100 hover:bg-white/10 hover:text-white")}>
            <Icon className={cn("h-[18px] w-[18px] transition-transform group-hover:scale-110", active && "text-primary")} />
            {label}
          </Link>
        );
      })}
      <div className="mt-auto space-y-3 pb-5 pt-6">
        <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-brand-800">{initials}</div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium text-white">{name}</p>
            <p className="text-[11px] capitalize text-blue-200">{role}</p>
          </div>
        </div>
        <form action={logout}>
          <button className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-blue-100 transition hover:bg-white/10 hover:text-white">
            <LogOut className="h-[18px] w-[18px]" /> Logout
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print brand-gradient sticky top-0 hidden h-screen w-64 shrink-0 flex-col lg:flex">
        <Brand />
        {nav}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print brand-gradient flex h-14 items-center justify-between px-4 text-white lg:hidden">
          <button aria-label="Open menu" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
          <span className="text-sm font-bold tracking-wide">UNIQUE NUMBERING PORTAL</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[11px] font-bold text-brand-800">{initials}</span>
        </header>
        <main className="flex-1 p-4 sm:p-8">{children}</main>
        <footer className="no-print px-8 pb-6 text-center text-xs text-muted-foreground">
          Unique Numbering Portal · every code is issued by the server and cannot be edited
        </footer>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="brand-gradient absolute inset-y-0 left-0 flex w-72 flex-col">
            <button className="absolute right-3 top-5 text-white" aria-label="Close menu" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
            <Brand />
            {nav}
          </aside>
        </div>
      )}
    </div>
  );
}
