import { DollarSign, Plus } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";

export default function DealsPage() {
  return (
    <PageShell
      icon={DollarSign}
      title="Deals"
      description="Track deal pipeline, stages, and revenue across your team's opportunities."
      actions={<Button size="sm" className="gap-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> New Deal</Button>}
      emptyState={{
        icon: DollarSign,
        title: "No deals yet",
        description: "Create deals to track opportunities through your pipeline stages. Monitor revenue forecasts and team performance.",
        actionLabel: "Create Deal",
        onAction: () => {},
      }}
    />
  );
}
