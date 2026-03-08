import { GitBranch, Plus } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";

export default function WorkflowsPage() {
  return (
    <PageShell
      icon={GitBranch}
      title="Workflows"
      description="Automate repetitive actions with rule-based workflows that trigger on data changes, imports, or schedules."
      actions={<Button size="sm" className="gap-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> New Workflow</Button>}
      emptyState={{
        icon: GitBranch,
        title: "No workflows configured",
        description: "Build automated workflows to route leads, update statuses, assign owners, and trigger actions based on conditions.",
        actionLabel: "Create Workflow",
        onAction: () => {},
      }}
    />
  );
}
