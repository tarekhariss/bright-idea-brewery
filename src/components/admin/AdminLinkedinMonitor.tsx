import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAdminLinkedinSummaries } from "@/hooks/use-admin";
import { format } from "date-fns";

export function AdminLinkedinMonitor() {
  const { data: accounts, isLoading } = useAdminLinkedinSummaries();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Global LinkedIn Monitor</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workspace</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Connects Today</TableHead>
              <TableHead>Messages Today</TableHead>
              <TableHead>Last Activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : !accounts?.length ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No LinkedIn account data yet.</TableCell></TableRow>
            ) : (
              accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs">{a.workspace_name ?? "—"}</TableCell>
                  <TableCell className="font-medium text-sm">{a.account_name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={a.connection_status === "connected" ? "default" : "secondary"} className="text-[10px]">
                      {a.connection_status}
                    </Badge>
                  </TableCell>
                  <TableCell>{a.health_score ?? 0}</TableCell>
                  <TableCell>{a.connects_sent_today ?? 0}</TableCell>
                  <TableCell>{a.messages_sent_today ?? 0}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.last_activity_at ? format(new Date(a.last_activity_at), "MMM d, HH:mm") : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
