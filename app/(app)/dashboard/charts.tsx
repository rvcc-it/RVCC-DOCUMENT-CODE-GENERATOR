"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface Datum { name: string; value: number }
const BLUE = "#1d4ed8";
const PALETTE = ["#1d4ed8", "#0891b2", "#7c3aed", "#d97706", "#059669", "#db2777", "#475569", "#65a30d", "#ea580c"];

function Panel({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="h-72">
        {empty ? <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No data for this selection.</p>
          : <ResponsiveContainer width="100%" height="100%">{children as React.ReactElement}</ResponsiveContainer>}
      </CardContent>
    </Card>
  );
}

function Bars({ data, horizontal }: { data: Datum[]; horizontal?: boolean }) {
  return (
    <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ left: horizontal ? 24 : 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
      {horizontal ? <><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} /></>
        : <><XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} /><YAxis allowDecimals={false} /></>}
      <Tooltip />
      <Bar dataKey="value" name="Documents" fill={BLUE} radius={4} />
    </BarChart>
  );
}

export function Charts(p: { byDepartment: Datum[]; byCategory: Datum[]; monthly: Datum[]; topUsers: Datum[]; revisions: Datum[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Documents by department" empty={!p.byDepartment.length}><Bars data={p.byDepartment} horizontal /></Panel>
      <Panel title="Documents by category" empty={!p.byCategory.length}><Bars data={p.byCategory} /></Panel>
      <Panel title="Monthly generation trend (12 months)" empty={!p.monthly.some((m) => m.value)}>
        <LineChart data={p.monthly}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip />
          <Line type="monotone" dataKey="value" name="Documents" stroke={BLUE} strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </Panel>
      <Panel title="Most active users" empty={!p.topUsers.length}><Bars data={p.topUsers} horizontal /></Panel>
      <Panel title="Revision statistics" empty={!p.revisions.length}>
        <PieChart>
          <Pie data={p.revisions} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} label>
            {p.revisions.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </Panel>
    </div>
  );
}
