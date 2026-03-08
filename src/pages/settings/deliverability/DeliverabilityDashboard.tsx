import {
  Activity, Inbox, Globe, BarChart3, TrendingUp,
  AlertTriangle, CheckCircle2, Mail,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useMailboxes, useSendingDomains } from "@/hooks/use-deliverability";
import { useMailboxHealth, useDomainSendLimits } from "@/hooks/use-outbound-config";

export default function DeliverabilityDashboard() {
  const { data: mailboxes, isLoading: mbLoading } = useMailboxes();
  const { data: domains, isLoading: domLoading } = useSendingDomains();
  const { data: healthData, isLoading: healthLoading } = useMailboxHealth();
  const { data: domainLimits } = useDomainSendLimits();
  const isLoading = mbLoading || domLoading || healthLoading;

  const totalSent7d = healthData?.reduce((s: number, h: any) => s + (h.sent_last_7_days || 0), 0) ?? 0;
  const totalSent30d = healthData?.reduce((s: number, h: any) => s + (h.sent_last_30_days || 0), 0) ?? 0;
  const avgBounceRate = healthData?.length
    ? (healthData.reduce((s: number, h: any) => s + (h.bounce_rate || 0), 0) / healthData.length).toFixed(1)
    : "0.0";
  const avgReplyRate = healthData?.length
    ? (healthData.reduce((s: number, h: any) => s + (h.reply_rate || 0), 0) / healthData.length).toFixed(1)
    : "0.0";
  const avgHealthScore = healthData?.length
    ? Math.round(healthData.reduce((s: number, h: any) => s + (h.health_score || 0), 0) / healthData.length)
    : 100;

  const stats = [
    { label: "Emails Sent (7d)", value: totalSent7d.toLocaleString(), icon: Mail, color: "text-blue-500 bg-blue-500/10" },
    { label: "Emails Sent (30d)", value: totalSent30d.toLocaleString(), icon: BarChart3, color: "text-violet-500 bg-violet-500/10" },
    { label: "Avg Bounce Rate", value: `${avgBounceRate}%`, icon: AlertTriangle, color: parseFloat(avgBounceRate as string) > 5 ? "text-destructive bg-destructive/10" : "text-emerald-500 bg-emerald-500/10" },
    { label: "Avg Reply Rate", value: `${avgReplyRate}%`, icon: TrendingUp, color: "text-emerald-500 bg-emerald-500/10" },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deliverability Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor mailbox health, sending volume, bounce rates, and domain activity.
          </p>
        </div>
      </div>

      {/* Top Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                  <p className="text-lg font-semibold leading-tight">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Overall Health Score */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            Overall Health Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold">{avgHealthScore}</div>
            <div className="flex-1">
              <Progress value={avgHealthScore} className="h-3" />
              <p className="text-xs text-muted-foreground mt-1">
                {avgHealthScore >= 80 ? "Excellent — your sending infrastructure is healthy" :
                 avgHealthScore >= 60 ? "Good — minor issues to address" :
                 "Needs attention — review mailbox health below"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mailbox Health Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            Mailbox Health ({healthData?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!healthData?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No mailbox health data yet. Health metrics will populate as mailboxes begin sending.
            </p>
          ) : (
            <div className="space-y-2">
              {healthData.map((h: any) => (
                <div key={h.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold">
                    {h.mailboxes?.provider_type?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{h.mailboxes?.email ?? "Unknown"}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-muted-foreground">Score: {h.health_score}</span>
                      <span className="text-[10px] text-muted-foreground">Bounce: {h.bounce_rate}%</span>
                      <span className="text-[10px] text-muted-foreground">Reply: {h.reply_rate}%</span>
                      <span className="text-[10px] text-muted-foreground">7d: {h.sent_last_7_days}</span>
                    </div>
                  </div>
                  <Badge className={`text-[10px] ${
                    h.health_score >= 80 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                    h.health_score >= 60 ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                    "bg-destructive/10 text-destructive"
                  }`}>
                    {h.health_score >= 80 ? "Good" : h.health_score >= 60 ? "Warning" : "Poor"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Domain Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            Domain Sending Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!domainLimits?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No domain send limits configured. Domain activity will appear when campaigns begin sending.
            </p>
          ) : (
            <div className="space-y-2">
              {domainLimits.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">{d.domain}</p>
                    <p className="text-[10px] text-muted-foreground">Max: {d.max_per_day}/day</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{d.sent_today} <span className="text-muted-foreground text-xs">today</span></p>
                    <p className="text-[10px] text-muted-foreground">{d.sent_last_30_days} last 30d</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
