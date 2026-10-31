"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Category, CompanySettings, Department, Profile } from "@/lib/types";
import { CompanyTab, NumberingTab } from "./settings-forms";
import { MasterTab } from "./master-tab";
import { UsersTab } from "./users-tab";
import { AuditTab } from "./audit-tab";

export interface AuditRow { id: string; action: string; table_name: string; record_id: string | null; created_at: string; user: string }

export function SettingsTabs(props: {
  settings: CompanySettings; departments: Department[]; categories: Category[]; users: Profile[];
  counts: Record<string, number>; audit: AuditRow[]; currentUserId: string;
}) {
  return (
    <Tabs defaultValue="company">
      <TabsList>
        <TabsTrigger value="company">Company</TabsTrigger>
        <TabsTrigger value="numbering">Numbering</TabsTrigger>
        <TabsTrigger value="departments">Departments</TabsTrigger>
        <TabsTrigger value="categories">Categories</TabsTrigger>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="audit">Audit log</TabsTrigger>
      </TabsList>
      <TabsContent value="company"><CompanyTab settings={props.settings} /></TabsContent>
      <TabsContent value="numbering"><NumberingTab settings={props.settings} /></TabsContent>
      <TabsContent value="departments">
        <MasterTab kind="department" rows={props.departments.map((d) => ({
          id: d.id, name: d.department_name, code: d.department_code, status: d.status, extra: props.counts[d.id] ?? 0,
        }))} />
      </TabsContent>
      <TabsContent value="categories">
        <MasterTab kind="category" rows={props.categories.map((c) => ({
          id: c.id, name: c.category_name, code: c.category_code, status: c.status, seqLen: c.sequence_length,
        }))} defaultSeqLen={props.settings.sequence_length} />
      </TabsContent>
      <TabsContent value="users"><UsersTab users={props.users} departments={props.departments} currentUserId={props.currentUserId} /></TabsContent>
      <TabsContent value="audit"><AuditTab rows={props.audit} /></TabsContent>
    </Tabs>
  );
}
