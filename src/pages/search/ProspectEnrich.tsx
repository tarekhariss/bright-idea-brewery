import { Sparkles, Users, Building2, List, Database, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const modules = [
  {
    icon: Users,
    title: "People Search",
    desc: "Find decision-makers by title, industry, location, and company.",
    url: "/search/people",
    color: "text-blue-500 bg-blue-500/10",
  },
  {
    icon: Building2,
    title: "Company Search",
    desc: "Discover target accounts by size, revenue, technology, and more.",
    url: "/search/companies",
    color: "text-emerald-500 bg-emerald-500/10",
  },
  {
    icon: List,
    title: "Lists",
    desc: "Organize prospects into targeted segments for outreach.",
    url: "/search/lists",
    color: "text-violet-500 bg-violet-500/10",
  },
  {
    icon: Database,
    title: "Data Enrichment",
    desc: "Enrich contact and company records with verified data.",
    url: "/search/data-enrichment",
    color: "text-amber-500 bg-amber-500/10",
  },
];

export default function ProspectEnrichPage() {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prospect & Enrich</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Find, verify, and enrich your ideal prospects across every channel.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modules.map((m) => (
          <Card
            key={m.url}
            className="group cursor-pointer hover:border-primary/30 transition-all hover:shadow-md"
            onClick={() => navigate(m.url)}
          >
            <CardContent className="p-5 flex items-start gap-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${m.color}`}>
                <m.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold group-hover:text-primary transition-colors">{m.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{m.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
