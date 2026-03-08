import { MessageSquare } from "lucide-react";
import { PageShell } from "@/components/PageShell";

export default function ConversationsPage() {
  return (
    <PageShell
      icon={MessageSquare}
      title="Conversations"
      description="View threaded conversations across email, LinkedIn, and other channels with full context."
      emptyState={{
        icon: MessageSquare,
        title: "No conversations yet",
        description: "When prospects reply to your outreach, conversations will appear here as unified threads with full message history and context.",
      }}
    />
  );
}
