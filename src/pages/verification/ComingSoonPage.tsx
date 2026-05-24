import { PageContainer, EmptyState } from "@/components/verification/kit";
import { Construction } from "lucide-react";

export default function VerificationComingSoonPage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <PageContainer>
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <EmptyState
        icon={Construction}
        title="In progress"
        description="This part of the Verification subsystem is being built in the next phase. The underlying data and APIs are already in place."
      />
    </PageContainer>
  );
}
