import Link from "next/link";
import { Building2, CalendarDays, CalendarRange, FileStack, GitBranch, Users } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Charts, type Datum } from "./charts";

export const metadata = { title: "Dashboard | Unique Numbering Portal" };

interface Stats {
  total: number; today: number; month: number; departments: number; users: number; revised: number;
  by_department: Datum[]; by_category: Datum[]; monthly: Datum[]; top_users: Datum[]; revisions: Datum[];
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; department?: string }> }) {
  const { supabase } = await requireSession(["admin", "management"]);
  const sp = await searchParams;
  const date = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const dept = sp.department && /^[0-9a-f-]{36}$/i.test(sp.department) ? sp.department : null;

  const [{ data, error }, depts] = await Promise.all([
    supabase.rpc("doc_code_gen_dashboard_stats", { p_from: date(sp.from), p_to: date(sp.to), p_department_id: dept }),
    supabase.from("doc_code_gen_departments").select("id,department_name").order("department_name"),
  ]);
  const s = data as Stats | null;

  const tiles = s ? [
    { label: "Total codes", value: s.total, icon: FileStack },
    { label: "Today", value: s.today, icon: CalendarDays },
    { label: "This month", value: s.month, icon: CalendarRange },
    { label: "Departments", value: s.departments, icon: Building2 },
    { label: "Active users", value: s.users, icon: Users },
    { label: "Revised documents", value: s.revised, icon: GitBranch },
  ] : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="text-2xl font-bold text-brand-800">Dashboard</h1>
      <Card><CardContent className="p-4">
        <form className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-xs font-medium">From<Input type="date" name="from" defaultValue={sp.from} /></label>
          <label className="space-y-1 text-xs font-medium">To<Input type="date" name="to" defaultValue={sp.to} /></label>
          <label className="space-y-1 text-xs font-medium">Department
            <Select name="department" defaultValue={sp.department ?? ""} className="min-w-[200px]">
              <option value="">All departments</option>
              {depts.data?.map((d) => <option key={d.id} value={d.id}>{d.department_name}</option>)}
            </Select>
          </label>
          <Button type="submit">Apply</Button>
          <Link href="/dashboard"><Button type="button" variant="ghost">Reset</Button></Link>
        </form>
      </CardContent></Card>

      {error || !s ? (
        <p className="rounded-md bg-red-50 p-4 text-sm text-destructive">Could not load statistics: {error?.message}</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {tiles.map(({ label, value, icon: Icon }) => (
              <Card key={label}><CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-accent p-2 text-primary"><Icon className="h-5 w-5" /></div>
                <div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
              </CardContent></Card>
            ))}
          </div>
          <Charts byDepartment={s.by_department} byCategory={s.by_category} monthly={s.monthly} topUsers={s.top_users} revisions={s.revisions} />
        </>
      )}
    </div>
  );
}
