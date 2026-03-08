import { Mail } from "lucide-react";
import { PageShell } from "@/components/PageShell";

export default function EmailsPage() {
  return (
    <PageShell
      icon={Mail}
      title="Emails"
      description="Track sent emails, opens, clicks, and replies across all your outreach campaigns."
      emptyState={{
        icon: Mail,
        title: "No email activity yet",
        description: "Once you start sending sequences or manual emails, all activity will appear here with real-time tracking and analytics.",
      }}
    />
  );
}
