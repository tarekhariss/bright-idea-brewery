/**
 * NotConfiguredBadge — small inline badge to put on cards/rows when a
 * dependency (mailbox, LinkedIn account, domain) is not configured.
 */
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function NotConfiguredBadge({ label = "Not configured" }: { label?: string }) {
  return (
    <Badge variant="outline" className="gap-1 border-amber-400/60 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
      <AlertTriangle className="h-3 w-3" />
      {label}
    </Badge>
  );
}
