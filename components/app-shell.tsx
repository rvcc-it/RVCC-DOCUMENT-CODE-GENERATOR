"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, FilePlus2, HelpCircle, History, LogOut, Menu, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";
import { logout } from "@/app/login/actions";

const NAV = [
  { href: "/generator", label: "Generator", icon: FilePlus2, roles: ["admin", "management", "employee"] },
  { href: "/history", label: "History", icon: History, roles: ["admin", "management", "employee"] },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3, roles: ["admin", "management"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
  { href: "/help", label: "Help", icon: HelpCircle, roles: ["admin", "management", "employee"] },
] as const;

export function AppShell({ role, name, children }: { role: Role; name: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => (n.roles as readonly string[]).includes(role));

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link key={href} href={href} onClick={() => setOpen(false)}
            className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition",
              active ? "bg-white/15 text-white" : "text-blue-100 hover:bg-white/10")}>
            <Icon className="h-4 w-4" /> {label}
          </Link>
        );
      })}
      <form action={logout} className="mt-auto">
        <button className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-blue-100 hover:bg-white/10">
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </form>
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print hidden w-60 shrink-0 flex-col bg-brand-800 lg:flex">
        <div className="border-b border-white/10 p-5 text-white">
          <p className="text-sm font-bold leading-tight">UNIQUE NUMBERING PORTAL</p>
          <p className="text-xs text-blue-200">Document Code Generator</p>
        </div>
        {nav}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex h-14 items-center justify-between bg-brand-700 px-4 text-white shadow">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
            <span className="text-sm font-semibold lg:hidden">UNIQUE NUMBERING PORTAL</span>
          </div>
          <div className="text-right text-xs">
            <p className="font-medium">{name}</p>
            <p className="capitalize text-blue-200">{role}</p>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-brand-800">
            <button className="absolute right-3 top-4 text-white" aria-label="Close menu" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
            <div className="border-b border-white/10 p-5 text-white">
              <p className="text-sm font-bold">UNIQUE NUMBERING PORTAL</p>
            </div>
            {nav}
          </aside>
        </div>
      )}
    </div>
  );
}
