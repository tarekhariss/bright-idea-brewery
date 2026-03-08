import { CheckSquare, Plus } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";

export default function TasksPage() {
  return (
    <PageShell
      icon={CheckSquare}
      title="Tasks"
      description="Track and manage outreach tasks, follow-ups, and action items across your team."
      actions={<Button size="sm" className="gap-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> New Task</Button>}
      emptyState={{
        icon: CheckSquare,
        title: "No tasks yet",
        description: "Tasks will appear here from sequences, manual assignments, and automated workflows. Stay on top of every prospect interaction.",
        actionLabel: "Create Task",
        onAction: () => {},
      }}
    />
  );
}
