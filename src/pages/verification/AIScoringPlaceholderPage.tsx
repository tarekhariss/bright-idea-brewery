import { PageContainer, SectionHeader } from "@/components/verification/kit";
import { Card } from "@/components/ui/card";
import { Sparkles, Brain, Network, LineChart } from "lucide-react";
import { ComingSoonBanner } from "@/components/config";

export default function AIScoringPlaceholderPage() {
  return (
    <PageContainer>
      <SectionHeader title="AI Risk Scoring" subtitle="Future module — schema is already in place" />
      <ComingSoonBanner
        title="AI risk scoring is not active yet"
        scope={["Behavioral signals", "Multi-engine consensus", "Bounce / open / reply feedback loop"]}
      />
      <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-card/40 p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-500">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Coming soon</h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              The verification engine schema reserves fields for AI-driven risk scoring, including behavioral signals,
              historical outcome correlation, and engagement-based confidence. No data is generated yet.
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <Pill icon={Brain} title="Behavioral signals" text="Pattern-based scoring across history" />
              <Pill icon={Network} title="Engine consensus" text="Multi-engine agreement scoring" />
              <Pill icon={LineChart} title="Outcome correlation" text="Bounce / open / reply feedback loop" />
            </div>
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}

function Pill({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="flex items-center gap-2 text-sm font-medium"><Icon className="h-3.5 w-3.5 text-violet-500" /> {title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
