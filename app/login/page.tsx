"use client";

import { useActionState } from "react";
import { FileText } from "lucide-react";
import { login } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 to-brand-700 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-6 p-8">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white">
              <FileText className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-bold text-brand-800">UNIQUE NUMBERING PORTAL</h1>
            <p className="text-sm text-muted-foreground">Document Code Generator</p>
          </div>
          <form action={action} className="space-y-4">
            <Field label="Email" required>
              <Input name="email" type="email" autoComplete="username" required />
            </Field>
            <Field label="Password" required>
              <Input name="password" type="password" autoComplete="current-password" required />
            </Field>
            {state?.error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-destructive">{state.error}</p>}
            <Button type="submit" className="w-full" loading={pending}>Sign in</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
