import { useCampaignPerformance, useCampaignAttribution } from "@/hooks/use-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AttributionSection } from "./AttributionSection";
import { Mail, MessageSquare, Calendar, Target, DollarSign, TrendingUp } from "lucide-react";

interface Props {
  campaignId: string;
}

export function CampaignAnalyticsTab({ campaignId }: Props) {
  const { data: perf } = useCampaignPerformance(campaignId);
  const { data: attributions } = useCampaignAttribution(campaignId);

  const metrics = [
    { label: "Emails Sent", value: perf?.emails_sent || 0, icon: Mail },
    { label: "Replies", value: perf?.replies_received || 0, icon: MessageSquare },
    { label: "Meetings", value: perf?.meetings_booked || 0, icon: Calendar },
    { label: "Deals", value: perf?.deals_created || 0, icon: Target },
    { label: "Revenue", value: `$${Number(perf?.revenue_generated || 0).toLocaleString()}`, icon: DollarSign },
  ];

  const rates = [
    { label: "Open Rate", value: perf?.open_rate },
    { label: "Reply Rate", value: perf?.reply_rate },
    { label: "Meeting Rate", value: perf?.meeting_rate },
    { label: "Deal Rate", value: perf?.deal_rate },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-3">
        {metrics.map(m => (
          <Card key={m.label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <m.icon className="h-3.5 w-3.5" /> {m.label}
              </div>
              <p className="text-lg font-bold">{typeof m.value === "number" ? m.value.toLocaleString() : m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Funnel Conversion Rates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rates.map(r => (
            <div key={r.label} className="flex items-center gap-3">
              <span className="text-xs w-24 text-muted-foreground">{r.label}</span>
              <Progress value={Number(r.value || 0)} className="h-2 flex-1" />
              <span className="text-xs tabular-nums w-12 text-right">{r.value != null ? `${Number(r.value).toFixed(1)}%` : "—"}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <AttributionSection attributions={attributions || []} title="Campaign Attribution" />
    </div>
  );
}
