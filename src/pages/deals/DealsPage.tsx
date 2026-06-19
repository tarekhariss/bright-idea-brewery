import { DollarSign } from "lucide-react";
import { PageShell } from "@/components/PageShell";

export default function DealsPage() {
  return (
    <PageShell
      icon={DollarSign}
      title="Deals"
      description="Track deal pipeline, stages, and revenue across your team's opportunities."
      comingSoon
      comingSoonScope={[
        "Database-backed deals (list + Kanban)",
        "Stages, owner, value, status, notes",
        "Linked company and contacts",
        "Deal-level activity timeline",
      ]}
      emptyState={{
        icon: DollarSign,
        title: "Deals module is part of round 3",
        description:
          "The full CRM Deals module (list, Kanban, CRUD, contact/company links) is planned. Until then this page is intentionally inert — clicking Create Deal would not save anything, so we removed the fake action to avoid data loss.",
      }}
    />
  );
}
