import { BarChart3, Megaphone, Users, MessageSquare, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useLinkedinCampaigns } from "@/hooks/use-linkedin-campaigns";
import { useLinkedinAccounts } from "@/hooks/use-linkedin";

export default function LinkedinAnalyticsPage() {
  const { data: campaigns } = useLinkedinCampaigns();
  const { data: accounts } = useLinkedinAccounts();
  const total = campaigns?.length || 0;
  const active = campaigns?.filter((c: any) => c.status === "active").length || 0;
  const accts = accounts?.length || 0;
  const connectsToday = accounts?.reduce((s: number, a: any) => s + (a.linkedin_account_health?.[0]?.connects_sent_today || 0), 0) || 0;
  const messagesToday = accounts?.reduce((s: number, a: any) => s + (a.linkedin_account_health?.[0]?.messages_sent_today || 0), 0) || 0;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600"><BarChart3 className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">LinkedIn Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Performance across all LinkedIn outreach.</p>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Campaigns", value: total, icon: Megaphone },
          { label: "Active", value: active, icon: Megaphone },
          { label: "Accounts", value: accts, icon: Users },
          { label: "Connects Today", value: connectsToday, icon: UserPlus },
          { label: "Messages Today", value: messagesToday, icon: MessageSquare },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-semibold mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
