import { useMemo } from "react";
import { BarChart3, TrendingUp, Mail, Reply, MousePointerClick, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCampaigns } from "@/hooks/use-campaigns";
import { cn } from "@/lib/utils";

export default function EngageAnalyticsPage() {
  const { data: campaigns, isLoading } = useCampaigns();

  const totals = useMemo(() => {
    const t = { sent: 0, opens: 0, clicks: 0, replies: 0, meetings: 0, bounces: 0 };
    (campaigns ?? []).forEach((c: any) => {
      const s = c.campaign_stats?.[0] ?? {};
      t.sent += s.emails_sent ?? 0;
      t.opens += s.opens ?? 0;
      t.clicks += s.clicks ?? 0;
      t.replies += s.replies ?? 0;
      t.meetings += s.meetings ?? 0;
      t.bounces += s.bounces ?? 0;
    });
    return t;
  }, [campaigns]);

  const rate = (n: number, d: number) => (d > 0 ? ((n / d) * 100).toFixed(1) : "0.0");

  const kpis = [
    { label: "Emails Sent", value: totals.sent.toLocaleString(), icon: Mail, color: "text-blue-600 bg-blue-500/10" },
    { label: "Open Rate", value: `${rate(totals.opens, totals.sent)}%`, sub: `${totals.opens} opens`, icon: TrendingUp, color: "text-emerald-600 bg-emerald-500/10" },
    { label: "Click Rate", value: `${rate(totals.clicks, totals.sent)}%`, sub: `${totals.clicks} clicks`, icon: MousePointerClick, color: "text-violet-600 bg-violet-500/10" },
    { label: "Reply Rate", value: `${rate(totals.replies, totals.sent)}%`, sub: `${totals.replies} replies`, icon: Reply, color: "text-amber-600 bg-amber-500/10" },
    { label: "Meetings", value: totals.meetings.toLocaleString(), icon: Target, color: "text-rose-600 bg-rose-500/10" },
    { label: "Bounce Rate", value: `${rate(totals.bounces, totals.sent)}%`, sub: `${totals.bounces} bounces`, icon: BarChart3, color: "text-muted-foreground bg-muted" },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b bg-card px-6 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
          <BarChart3 className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-base font-semibold leading-tight">Analytics</h1>
          <p className="text-xs text-muted-foreground">Outbound performance across all campaigns</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {kpis.map((k) => (
              <Card key={k.label} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
                    <p className="mt-1 text-2xl font-semibold leading-tight tabular-nums">{k.value}</p>
                    {k.sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{k.sub}</p>}
                  </div>
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-md", k.color)}>
                    <k.icon className="h-4 w-4" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Campaign Performance</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Top-performing campaigns by reply rate.</p>
          <div className="mt-4 space-y-2">
            {(campaigns ?? []).length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No campaign data yet.</p>
            ) : (
              (campaigns ?? []).slice(0, 10).map((c: any) => {
                const s = c.campaign_stats?.[0] ?? {};
                const sent = s.emails_sent ?? 0;
                const replies = s.replies ?? 0;
                const replyRate = sent > 0 ? (replies / sent) * 100 : 0;
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-md border bg-card/40 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">{sent} sent · {replies} replies</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold tabular-nums">{replyRate.toFixed(1)}%</p>
                      <p className="text-[10px] text-muted-foreground">reply rate</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
