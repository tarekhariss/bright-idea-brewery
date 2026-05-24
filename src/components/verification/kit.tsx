import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function KpiCard({
  label, value, hint, icon: Icon, trend, accent = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: any;
  trend?: { dir: "up" | "down" | "flat"; text: string };
  accent?: "default" | "emerald" | "rose" | "amber" | "sky" | "violet";
}) {
  const accentMap: Record<string, string> = {
    default: "from-card/80 to-card/40 border-border",
    emerald: "from-emerald-500/10 to-card/40 border-emerald-500/20",
    rose: "from-rose-500/10 to-card/40 border-rose-500/20",
    amber: "from-amber-500/10 to-card/40 border-amber-500/20",
    sky: "from-sky-500/10 to-card/40 border-sky-500/20",
    violet: "from-violet-500/10 to-card/40 border-violet-500/20",
  };
  return (
    <Card className={cn(
      "relative overflow-hidden border bg-gradient-to-br p-4 transition-all hover:shadow-md",
      accentMap[accent]
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          {hint && <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{hint}</p>}
        </div>
        {Icon && (
          <div className="ml-3 flex h-9 w-9 items-center justify-center rounded-lg bg-background/60 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      {trend && (
        <div className={cn(
          "mt-2 flex items-center gap-1 text-[11px]",
          trend.dir === "up" && "text-emerald-500",
          trend.dir === "down" && "text-rose-500",
          trend.dir === "flat" && "text-muted-foreground"
        )}>
          {trend.dir === "up" && <TrendingUp className="h-3 w-3" />}
          {trend.dir === "down" && <TrendingDown className="h-3 w-3" />}
          {trend.dir === "flat" && <Minus className="h-3 w-3" />}
          <span>{trend.text}</span>
        </div>
      )}
    </Card>
  );
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const m: Record<string, string> = {
    online: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    idle: "bg-sky-500/10 text-sky-500 border-sky-500/20",
    degraded: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    offline: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    processing: "bg-sky-500/10 text-sky-500 border-sky-500/20",
    completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    pending: "bg-muted text-muted-foreground border-border",
    failed: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    cancelled: "bg-muted text-muted-foreground border-border",
  };
  return <Badge variant="outline" className={cn("text-[11px] capitalize", m[status] ?? "")}>{status?.replace(/_/g, " ")}</Badge>;
}

export function RiskTierBadge({ tier }: { tier?: string | null }) {
  if (!tier) return <Badge variant="outline" className="text-[11px] text-muted-foreground">—</Badge>;
  const m: Record<string, string> = {
    low: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    medium: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    critical: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  };
  return <Badge variant="outline" className={cn("text-[11px] capitalize", m[tier] ?? "")}>{tier}</Badge>;
}

export function EmptyState({
  icon: Icon, title, description, action,
}: { icon: any; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-card/30 py-14 px-6 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1600px] space-y-6 px-6 py-6">{children}</div>;
}

export function Spark({ values }: { values: number[] }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const w = 80, h = 24;
  const step = w / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline fill="none" stroke="currentColor" strokeWidth={1.5} points={pts} className="text-emerald-500" />
    </svg>
  );
}
