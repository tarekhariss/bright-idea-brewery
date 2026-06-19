import { MessageSquare } from "lucide-react";
import { PageShell } from "@/components/PageShell";

export default function ConversationsPage() {
  return (
    <PageShell
      icon={MessageSquare}
      title="Conversations"
      description="View threaded conversations across email, LinkedIn, and other channels with full context."
      comingSoon
      comingSoonScope={[
        "Unified email + LinkedIn thread view",
        "Contact and deal context per thread",
        "Inline reply via connected mailbox or LinkedIn account",
      ]}
      emptyState={{
        icon: MessageSquare,
        title: "No conversations yet",
        description:
          "Today, email replies live in Engage → Unibox and LinkedIn replies live in LinkedIn → Inbox. This unified view is part of the planned CRM module.",
      }}
    />
  );
}
