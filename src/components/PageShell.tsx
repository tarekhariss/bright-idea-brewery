import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ComingSoonBanner, ComingSoonBadge } from "@/components/config";

interface PageShellProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  emptyState?: {
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
  };
  /** When true, renders a "Coming soon — not active yet" banner at the top. */
  comingSoon?: boolean;
  /** Optional planned-scope bullets shown inside the banner. */
  comingSoonScope?: string[];
}

export function PageShell({
  icon: Icon,
  title,
  description,
  actions,
  children,
  emptyState,
  comingSoon,
  comingSoonScope,
}: PageShellProps) {
  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {comingSoon && <ComingSoonBadge />}
            </div>
            {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {comingSoon && <ComingSoonBanner scope={comingSoonScope} />}

      {children ? (
        children
      ) : emptyState ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <emptyState.icon className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-medium">{emptyState.title}</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">{emptyState.description}</p>
            {emptyState.actionLabel && emptyState.onAction && (
              <Button size="sm" className="mt-5" onClick={emptyState.onAction}>
                {emptyState.actionLabel}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

