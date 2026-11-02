"use client";

import { useActionState } from "react";
import { FileText, Hash, ShieldCheck, Sparkles } from "lucide-react";
import { login } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

const POINTS = [
  { icon: Hash, text: "Unique, sequential document codes" },
  { icon: ShieldCheck, text: "Server-issued, tamper-proof references" },
  { icon: Sparkles, text: "Full history and revision tracking" },
];

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="brand-gradient relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30"><FileText className="h-5 w-5" /></div>
          <p className="text-sm font-bold tracking-widest">UNIQUE NUMBERING PORTAL</p>
        </div>
        <div className="relative space-y-8">
          <div>
            <h1 className="text-4xl font-extrabold leading-tight">Document codes,<br />issued once. Never duplicated.</h1>
            <p className="mt-3 max-w-md text-blue-100">One central place to generate and track every document reference number in your company.</p>
          </div>
          <ul className="space-y-3">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-blue-50">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15"><Icon className="h-4 w-4" /></span>{text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative font-mono text-sm text-blue-200">RVCC26-O-F-001-00</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="pop-in glass-card w-full max-w-md space-y-7 p-8 sm:p-10">
          <div>
            <div className="brand-gradient mb-5 flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg shadow-blue-600/30 lg:hidden">
              <FileText className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold text-brand-800">Welcome back</h2>
            <p className="text-sm text-muted-foreground">Sign in to generate and manage document codes.</p>
          </div>
          <form action={action} className="space-y-4">
            <Field label="Email" required><Input name="email" type="email" autoComplete="username" required placeholder="you@company.com" /></Field>
            <Field label="Password" required><Input name="password" type="password" autoComplete="current-password" required placeholder="••••••••••" /></Field>
            {state?.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-destructive">{state.error}</p>}
            <Button type="submit" size="lg" className="w-full" loading={pending}>Sign in</Button>
          </form>
        </div>
      </section>
    </main>
  );
}
