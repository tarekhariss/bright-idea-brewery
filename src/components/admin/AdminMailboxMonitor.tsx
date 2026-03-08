import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAdminMailboxSummaries } from "@/hooks/use-admin";

function healthBadge(score: number) {
  if (score >= 80) return <Badge className="bg-emerald-500/15 text-emerald-600 border-0 text-[10px]">Good</Badge>;
  if (score >= 50) return <Badge className="bg-amber-500/15 text-amber-600 border-0 text-[10px]">Warning</Badge>;
  return <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">Poor</Badge>;
}

export function AdminMailboxMonitor() {
  const { data: mailboxes, isLoading } = useAdminMailboxSummaries();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Global Deliverability Monitor</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workspace</TableHead>
              <TableHead>Mailbox</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Bounce Rate</TableHead>
              <TableHead>Reply Rate</TableHead>
              <TableHead>Sent (7d)</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : !mailboxes?.length ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No mailbox data available yet.</TableCell></TableRow>
            ) : (
              mailboxes.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs">{m.workspace_name ?? "—"}</TableCell>
                  <TableCell className="font-medium text-sm">{m.mailbox_email ?? "—"}</TableCell>
                  <TableCell className="text-xs">{m.provider ?? "—"}</TableCell>
                  <TableCell>{healthBadge(m.health_score ?? 0)}</TableCell>
                  <TableCell className="text-xs">{((m.bounce_rate ?? 0) * 100).toFixed(1)}%</TableCell>
                  <TableCell className="text-xs">{((m.reply_rate ?? 0) * 100).toFixed(1)}%</TableCell>
                  <TableCell>{m.emails_sent_7d ?? 0}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{m.status}</Badge></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
