import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireSession();
  return (
    <AppShell role={profile.role} name={profile.full_name || profile.email}>
      {children}
    </AppShell>
  );
}
