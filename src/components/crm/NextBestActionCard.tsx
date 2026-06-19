/**
 * NextBestActionCard — surfaces the next best action for an opportunity.
 * Prefers AI suggestion when present; otherwise falls back to rule-based.
 * Renders compact or full variants for record / inbox / command center.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Wand2 } from "lucide-react";
import { ruleNextBestAction } from "@/lib/crm-rules";
import type { Opportunity } from "@/hooks/use-opportunities";

export function NextBestActionCard({ opportunity, staleDays, compact }: {
  opportunity: Opportunity;
  staleDays: number;
  compact?: boolean;
}) {
  const aiAction = opportunity.ai_next_best_action?.trim();
  const aiSummary = opportunity.ai_summary?.trim();
  const rule = ruleNextBestAction(opportunity, staleDays);
  const usingAi = !!aiAction;

  const title = usingAi ? aiAction! : rule.title;
  const rationale = usingAi ? (aiSummary ?? "AI-generated suggestion based on opportunity context.") : rule.rationale;

  if (compact) {
    return (
      <div className="flex items-start gap-2 rounded-md border bg-card p-2">
        <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-primary">
          {usingAi ? <Sparkles className="h-3.5 w-3.5" /> : <Wand2 className="h-3.5 w-3.5" />}
        </span>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Next best action {usingAi ? "(AI)" : "(rule)"}</div>
          <div className="text-sm font-medium truncate">{title}</div>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          {usingAi ? <Sparkles className="h-4 w-4 text-primary" /> : <Wand2 className="h-4 w-4 text-primary" />}
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Next best action {usingAi ? "(AI)" : "(rule-based)"}
          </div>
          {opportunity.urgency && opportunity.urgency !== "normal" && (
            <Badge variant="secondary" className="ml-auto text-[10px] capitalize">{opportunity.urgency}</Badge>
          )}
        </div>
        <div className="text-base font-semibold leading-snug">{title}</div>
        {rationale && <div className="text-sm text-muted-foreground whitespace-pre-wrap">{rationale}</div>}
        {usingAi && opportunity.objections && opportunity.objections.length > 0 && (
          <div className="pt-1 flex flex-wrap gap-1">
            {opportunity.objections.slice(0, 4).map((o, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">⚠ {o}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
