import { Database } from "lucide-react";
import { PageShell } from "@/components/PageShell";

export default function DataEnrichmentPage() {
  return (
    <PageShell
      icon={Database}
      title="Data Enrichment"
      description="Enrich contact and company records with verified firmographic, technographic, and contact data."
      emptyState={{
        icon: Database,
        title: "Enrichment engine coming soon",
        description: "Connect enrichment providers to automatically fill in missing fields, verify emails, and score data quality across your database.",
      }}
    />
  );
}
