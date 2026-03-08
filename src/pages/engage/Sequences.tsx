import { GitBranch, Plus } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";

export default function SequencesPage() {
  return (
    <PageShell
      icon={GitBranch}
      title="Sequences"
      description="Build multi-step outreach sequences with automated follow-ups across email, phone, and LinkedIn."
      actions={<Button size="sm" className="gap-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> New Sequence</Button>}
      emptyState={{
        icon: GitBranch,
        title: "No sequences yet",
        description: "Create your first automated outreach sequence to engage prospects at scale with personalized multi-channel touchpoints.",
        actionLabel: "Create Sequence",
        onAction: () => {},
      }}
    />
  );
}
