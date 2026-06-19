/**
 * ComingSoonBanner / ComingSoonBadge — honest placeholders for features that
 * are in the roadmap but not yet implemented end-to-end.
 *
 * Use this anywhere we previously had a fake-working UI shell. The route and
 * navigation entry stay visible (so we don't lose track), but the page is
 * clearly labelled "Not active yet" with the planned scope.
 */
import { Construction, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface BannerProps {
  title?: string;
  /** Short list of capabilities this surface will offer once built. */
  scope?: string[];
}

export function ComingSoonBanner({ title = "Coming soon — not active yet", scope }: BannerProps) {
  return (
    <Alert className="mb-4 border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700/40 dark:bg-sky-950/30 dark:text-sky-100">
      <Construction className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="text-sm">
          This page is part of the product roadmap. The interface is visible so we don't
          forget it, but no live data flows through it yet and any actions you take here
          will not be persisted to a real backend.
        </p>
        {scope && scope.length > 0 && (
          <div className="text-xs">
            <span className="font-medium">Planned scope: </span>
            {scope.join(" · ")}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

export function ComingSoonBadge({ label = "Coming soon" }: { label?: string }) {
  return (
    <Badge variant="outline" className="gap-1 border-sky-400/60 bg-sky-50 text-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
      <Clock className="h-3 w-3" />
      {label}
    </Badge>
  );
}
