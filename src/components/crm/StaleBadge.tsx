import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { isStale, daysSinceActivity } from "@/lib/crm-rules";
import type { Opportunity } from "@/hooks/use-opportunities";

export function StaleBadge({ opportunity, staleDays, compact }: {
  opportunity: Pick<Opportunity, "status" | "last_activity_at" | "next_action_at" | "created_at">;
  staleDays: number;
  compact?: boolean;
}) {
  if (!isStale(opportunity, staleDays)) return null;
  const d = daysSinceActivity(opportunity as any);
  return (
    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 gap-1 text-[10px]">
      <AlertTriangle className="h-3 w-3" />
      {compact ? `Stale ${d ?? "—"}d` : `Stale · ${d ?? "—"} days no activity`}
    </Badge>
  );
}
