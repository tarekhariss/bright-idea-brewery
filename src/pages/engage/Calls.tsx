import { Phone } from "lucide-react";
import { PageShell } from "@/components/PageShell";

export default function CallsPage() {
  return (
    <PageShell
      icon={Phone}
      title="Calls"
      description="Manage call tasks, track call outcomes, and log conversation notes from your outreach."
      emptyState={{
        icon: Phone,
        title: "No calls logged yet",
        description: "When your team starts making calls through sequences or manual outreach, call logs and outcomes will be tracked here.",
      }}
    />
  );
}
