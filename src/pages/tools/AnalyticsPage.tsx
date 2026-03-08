import { BarChart3 } from "lucide-react";
import { PageShell } from "@/components/PageShell";

export default function AnalyticsPage() {
  return (
    <PageShell
      icon={BarChart3}
      title="Analytics"
      description="Measure outreach performance, pipeline velocity, team productivity, and data quality trends."
      emptyState={{
        icon: BarChart3,
        title: "Analytics dashboard coming soon",
        description: "Track email performance, call outcomes, sequence effectiveness, and team metrics with real-time dashboards and exportable reports.",
      }}
    />
  );
}
