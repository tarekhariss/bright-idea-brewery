import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Activity, User, FileText, Settings, Upload, Trash2, Pencil } from "lucide-react";

const ACTION_ICONS: Record<string, any> = {
  create: FileText,
  update: Pencil,
  delete: Trash2,
  import: Upload,
  settings: Settings,
  login: User,
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  update: "bg-primary/10 text-primary border-primary/20",
  delete: "bg-destructive/10 text-destructive border-destructive/20",
  import: "bg-amber-500/10 text-amber-600 border-amber-200",
};

export default function SystemActivityLogViewer() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["system-activity-log"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("system_activity_log") as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">System Activity Log</h2>
        <p className="text-sm text-muted-foreground">Audit log of all system events, changes, and admin actions.</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : !logs?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <Activity className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-medium">No activity logged</h3>
            <p className="text-sm text-muted-foreground mt-1.5">System activity will appear here as actions are performed.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Action</TableHead>
                <TableHead className="text-xs">Entity</TableHead>
                <TableHead className="text-xs">Details</TableHead>
                <TableHead className="text-xs">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: any) => {
                const actionBase = log.action?.split("_")[0] || "update";
                return (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] capitalize ${ACTION_COLORS[actionBase] ?? ""}`}>
                        {log.action?.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.entity_type && (
                        <span className="capitalize">{log.entity_type}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                      {log.details ? JSON.stringify(log.details).slice(0, 100) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "MMM d, h:mm a")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
