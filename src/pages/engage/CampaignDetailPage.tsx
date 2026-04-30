import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Play, Pause, Megaphone, BarChart3, Users, GitBranch, Calendar, Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCampaign, useUpdateCampaign } from "@/hooks/use-campaigns";
import { useCampaignLeads } from "@/hooks/use-campaign-detail";
import { CampaignAnalyticsTab } from "@/components/analytics/CampaignAnalyticsTab";
import { CampaignLeadsTab } from "@/components/engage/campaign/CampaignLeadsTab";
import { CampaignSequencesTab } from "@/components/engage/campaign/CampaignSequencesTab";
import { CampaignScheduleTab } from "@/components/engage/campaign/CampaignScheduleTab";
import { CampaignOptionsTab } from "@/components/engage/campaign/CampaignOptionsTab";
import { cn } from "@/lib/utils";

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    paused: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    completed: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  };
  return <Badge className={cn("text-[10px] capitalize", map[s] ?? map.draft)}>{s}</Badge>;
};

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: campaign, isLoading } = useCampaign(id || null);
  const { data: leads } = useCampaignLeads(id || null);
  const updateCampaign = useUpdateCampaign();

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="mb-4 h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (!campaign || !id) {
    return <div className="p-6 text-sm text-muted-foreground">Campaign not found.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-card px-6 py-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/engage/campaigns")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Megaphone className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-semibold leading-tight">{campaign.name}</h1>
            {statusBadge(campaign.status)}
          </div>
          <p className="text-xs text-muted-foreground">
            {leads?.length ?? 0} lead{(leads?.length ?? 0) === 1 ? "" : "s"} · {campaign.daily_limit ?? 50}/day limit
          </p>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === "draft" && (
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => updateCampaign.mutate({ id, status: "active" as any })}>
              <Play className="h-3.5 w-3.5" /> Activate
            </Button>
          )}
          {campaign.status === "active" && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => updateCampaign.mutate({ id, status: "paused" as any })}>
              <Pause className="h-3.5 w-3.5" /> Pause
            </Button>
          )}
          {campaign.status === "paused" && (
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => updateCampaign.mutate({ id, status: "active" as any })}>
              <Play className="h-3.5 w-3.5" /> Resume
            </Button>
          )}
        </div>
      </div>

      {/* Tabbed workspace */}
      <Tabs defaultValue="analytics" className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b bg-card/50 px-6">
          <TabsList className="h-10 bg-transparent p-0">
            {[
              { v: "analytics", label: "Analytics", icon: BarChart3 },
              { v: "leads", label: "Leads", icon: Users },
              { v: "sequences", label: "Sequences", icon: GitBranch },
              { v: "schedule", label: "Schedule", icon: Calendar },
              { v: "options", label: "Options", icon: Settings },
            ].map((t) => (
              <TabsTrigger
                key={t.v}
                value={t.v}
                className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-3 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <TabsContent value="analytics" className="mt-0"><CampaignAnalyticsTab campaignId={id} /></TabsContent>
          <TabsContent value="leads" className="mt-0"><CampaignLeadsTab campaignId={id} /></TabsContent>
          <TabsContent value="sequences" className="mt-0"><CampaignSequencesTab campaignId={id} /></TabsContent>
          <TabsContent value="schedule" className="mt-0"><CampaignScheduleTab campaignId={id} /></TabsContent>
          <TabsContent value="options" className="mt-0"><CampaignOptionsTab campaignId={id} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
