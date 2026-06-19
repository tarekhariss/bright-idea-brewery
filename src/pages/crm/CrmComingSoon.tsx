import { PageShell } from "@/components/PageShell";
import { Construction } from "lucide-react";

export default function CrmComingSoon({ title, scope }: { title: string; scope?: string[] }) {
  return (
    <PageShell
      icon={Construction}
      title={title}
      description="This CRM surface is in Phase 1 of build. Available now: Inbox, Pipeline, Opportunities, Settings."
      comingSoon
      comingSoonScope={scope}
    />
  );
}
