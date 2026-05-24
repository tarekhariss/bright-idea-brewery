import { PageContainer, SectionHeader, KpiCard } from "@/components/verification/kit";
import { useVerificationQuota, useUpdateQuota } from "@/hooks/use-verification-platform";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Gauge, Shield } from "lucide-react";
import { useState, useEffect } from "react";

export default function QuotasPage() {
  const { data: quota, isLoading } = useVerificationQuota();
  const update = useUpdateQuota();
  const [daily, setDaily] = useState<string>("");
  const [monthly, setMonthly] = useState<string>("");

  useEffect(() => {
    if (quota) {
      setDaily(String(quota.daily_limit));
      setMonthly(String(quota.monthly_limit));
    }
  }, [quota]);

  const dailyPct = quota ? Math.min(100, (quota.used_today / Math.max(quota.daily_limit, 1)) * 100) : 0;
  const monthlyPct = quota ? Math.min(100, (quota.used_month / Math.max(quota.monthly_limit, 1)) * 100) : 0;

  return (
    <PageContainer>
      <SectionHeader title="Quotas" subtitle="Daily and monthly verification limits for this workspace, with abuse safeguards." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Used today" value={quota?.used_today?.toLocaleString() ?? 0} hint={`of ${quota?.daily_limit?.toLocaleString() ?? "—"}`} icon={Gauge} accent="sky" />
        <KpiCard label="Used this month" value={quota?.used_month?.toLocaleString() ?? 0} hint={`of ${quota?.monthly_limit?.toLocaleString() ?? "—"}`} accent="emerald" />
        <KpiCard label="Daily utilization" value={`${dailyPct.toFixed(0)}%`} accent={dailyPct > 80 ? "amber" : "default"} />
        <KpiCard label="Abuse flag" value={quota?.abuse_flagged ? "Yes" : "No"} accent={quota?.abuse_flagged ? "rose" : "emerald"} icon={Shield} />
      </div>

      <Card className="p-5 space-y-4">
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Daily</span><span>{quota?.used_today ?? 0} / {quota?.daily_limit ?? "—"}</span>
          </div>
          <Progress value={dailyPct} />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Monthly</span><span>{quota?.used_month ?? 0} / {quota?.monthly_limit ?? "—"}</span>
          </div>
          <Progress value={monthlyPct} />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Adjust limits</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div><label className="text-xs text-muted-foreground">Daily limit</label>
            <Input type="number" value={daily} onChange={(e) => setDaily(e.target.value)} disabled={isLoading} /></div>
          <div><label className="text-xs text-muted-foreground">Monthly limit</label>
            <Input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} disabled={isLoading} /></div>
          <div className="flex items-end">
            <Button onClick={() => update.mutate({ daily_limit: Number(daily), monthly_limit: Number(monthly) })} disabled={update.isPending}>
              Save quotas
            </Button>
          </div>
        </div>
        {quota?.abuse_reason && (
          <p className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/5 p-2 text-xs text-rose-500">Abuse flag reason: {quota.abuse_reason}</p>
        )}
      </Card>
    </PageContainer>
  );
}
