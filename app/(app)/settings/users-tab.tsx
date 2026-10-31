"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Pencil, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { Department, Profile, Role } from "@/lib/types";
import { createUser, resetUserAccess, updateUser } from "./actions";

const empty = { id: "", email: "", password: "", full_name: "", employee_id: "", department_id: "", role: "employee" as Role, status: "active" as "active" | "inactive" };

export function UsersTab({ users, departments, currentUserId }: { users: Profile[]; departments: Department[]; currentUserId: string }) {
  const router = useRouter();
  const [form, setForm] = useState<typeof empty | null>(null);
  const [reset, setReset] = useState<{ user: Profile; password: string } | null>(null);
  const [pending, start] = useTransition();
  const deptName = (id: string | null) => departments.find((d) => d.id === id)?.department_name ?? "—";
  const isNew = form && !form.id;

  const submit = () => form && start(async () => {
    const res = isNew
      ? await createUser({ email: form.email, password: form.password, full_name: form.full_name, employee_id: form.employee_id, department_id: form.department_id, role: form.role })
      : await updateUser({ id: form.id, full_name: form.full_name, employee_id: form.employee_id, department_id: form.department_id, role: form.role, status: form.status });
    if (res.ok) { toast.success(isNew ? "User created" : "User updated"); setForm(null); router.refresh(); } else toast.error(res.error);
  });

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form!, [k]: e.target.value });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Users</CardTitle>
        <Button size="sm" onClick={() => setForm(empty)}><UserPlus className="h-4 w-4" /> Add user</Button>
      </CardHeader>
      <Table>
        <THead><TR className="hover:bg-transparent"><TH>Name</TH><TH>Email</TH><TH>Employee ID</TH><TH>Department</TH><TH>Role</TH><TH>Status</TH><TH className="text-right">Actions</TH></TR></THead>
        <TBody>
          {users.map((u) => (
            <TR key={u.id}>
              <TD className="font-medium">{u.full_name}</TD><TD>{u.email}</TD><TD>{u.employee_id ?? "—"}</TD>
              <TD>{deptName(u.department_id)}</TD>
              <TD><Badge tone="blue" className="capitalize">{u.role}</Badge></TD>
              <TD><Badge tone={u.status === "active" ? "green" : "grey"} className="capitalize">{u.status}</Badge></TD>
              <TD className="text-right">
                <Button variant="ghost" size="icon" aria-label="Edit user" onClick={() => setForm({
                  id: u.id, email: u.email, password: "", full_name: u.full_name, employee_id: u.employee_id ?? "",
                  department_id: u.department_id ?? "", role: u.role, status: u.status,
                })}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" aria-label="Reset access" onClick={() => setReset({ user: u, password: "" })}><KeyRound className="h-4 w-4" /></Button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent title={isNew ? "Add user" : "Edit user"}>
          {form && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" required className="sm:col-span-2"><Input value={form.full_name} onChange={set("full_name")} /></Field>
              <Field label="Email" required className="sm:col-span-2"><Input type="email" value={form.email} disabled={!isNew} onChange={set("email")} /></Field>
              {isNew && <Field label="Temporary password" required hint="Minimum 10 characters" className="sm:col-span-2">
                <Input type="password" autoComplete="new-password" value={form.password} onChange={set("password")} /></Field>}
              <Field label="Employee ID"><Input value={form.employee_id} onChange={set("employee_id")} /></Field>
              <Field label="Department">
                <Select value={form.department_id} onChange={set("department_id")}>
                  <option value="">None</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.department_name}</option>)}
                </Select>
              </Field>
              <Field label="Role">
                <Select value={form.role} onChange={set("role")} disabled={form.id === currentUserId}>
                  <option value="employee">Employee</option><option value="management">Management</option><option value="admin">Administrator</option>
                </Select>
              </Field>
              {!isNew && (
                <Field label="Status">
                  <Select value={form.status} onChange={set("status")} disabled={form.id === currentUserId}>
                    <option value="active">Active</option><option value="inactive">Inactive</option>
                  </Select>
                </Field>
              )}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
                <Button loading={pending} onClick={submit}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!reset} onOpenChange={(o) => !o && setReset(null)}>
        <DialogContent title={`Reset access for ${reset?.user.full_name}`} description="Sets a new password and signs the user out of all sessions." className="max-w-md">
          <div className="grid gap-4">
            <Field label="New temporary password" required hint="Minimum 10 characters">
              <Input type="password" autoComplete="new-password" value={reset?.password ?? ""} onChange={(e) => setReset({ ...reset!, password: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReset(null)}>Cancel</Button>
              <Button variant="destructive" loading={pending} onClick={() => reset && start(async () => {
                const res = await resetUserAccess(reset.user.id, reset.password);
                if (res.ok) { toast.success("Access reset"); setReset(null); } else toast.error(res.error);
              })}>Reset access</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
