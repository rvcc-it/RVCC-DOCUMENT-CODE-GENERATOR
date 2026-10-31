import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import type { AuditRow } from "./settings-tabs";

export function AuditTab({ rows }: { rows: AuditRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit log</CardTitle>
        <CardDescription>Most recent 100 events. The log is append-only.</CardDescription>
      </CardHeader>
      <Table>
        <THead><TR className="hover:bg-transparent"><TH>When</TH><TH>User</TH><TH>Action</TH><TH>Table</TH><TH>Record</TH></TR></THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="whitespace-nowrap">{formatDateTime(r.created_at)}</TD><TD>{r.user}</TD>
              <TD><Badge tone="blue">{r.action}</Badge></TD><TD className="font-mono text-xs">{r.table_name}</TD>
              <TD className="font-mono text-xs">{r.record_id?.slice(0, 8)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
