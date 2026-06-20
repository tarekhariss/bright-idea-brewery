import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIntelligenceV2 } from "@/hooks/use-intelligence-v2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert, Users, Building2, Mail, Database, AlertTriangle } from "lucide-react";

export default function DataQualityPage() {
  const { workspaceId } = useAuth();
  const { enabled: v2, isLoading: flagLoading } = useIntelligenceV2();

  const { data, isLoading } = useQuery({
    queryKey: ["data-quality", workspaceId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_workspace_data_quality", { p_workspace_id: workspaceId });
      if (error) throw error;
      return data as any;
    },
    enabled: !!workspaceId && v2,
  });

  if (flagLoading) return <div className="p-6"><Skeleton className="h-8 w-64" /></div>;
  if (!v2) return (
    <div className="p-6">
      <Card><CardContent className="p-8 text-center text-muted-foreground">
        <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Data Quality is part of Intelligence v2 and is not enabled for this workspace.</p>
      </CardContent></Card>
    </div>
  );

  const c = data?.contacts ?? {};
  const co = data?.companies ?? {};
  const es = data?.email_status ?? {};
  const q = data?.quarantine ?? {};
  const cf = data?.custom_fields ?? {};

  const StatCard = ({ icon: Icon, label, value, hint }: any) => (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5" /><span className="text-xs">{label}</span></div>
      <p className="text-2xl font-semibold mt-1">{isLoading ? <Skeleton className="h-7 w-20" /> : (Number(value ?? 0)).toLocaleString()}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </CardContent></Card>
  );

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Data Quality</h1>
        <p className="text-sm text-muted-foreground mt-1">Real counts from your workspace. No estimates, no scores.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total contacts" value={c.total} />
        <StatCard icon={Building2} label="Total companies" value={co.total} />
        <StatCard icon={Users} label="Contacts with company_id" value={c.with_company} />
        <StatCard icon={Database} label="Custom fields" value={cf.total} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Identity coverage</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Mail} label="Missing email" value={c.missing_email} />
          <StatCard icon={Building2} label="Missing company" value={c.missing_company} />
          <StatCard icon={Building2} label="Missing domain" value={co.missing_domain} />
          <StatCard icon={AlertTriangle} label="Quarantine pending" value={q.pending} hint={`${q.approved ?? 0} approved · ${q.excluded ?? 0} excluded`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Canonical email status</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              ["valid", "Valid", "default"], ["catch_all", "Catch-all", "secondary"], ["risky", "Risky", "secondary"],
              ["unknown", "Unknown", "outline"], ["invalid", "Invalid", "destructive"], ["bounced", "Bounced", "destructive"],
              ["suppressed", "Suppressed", "destructive"], ["unverified", "Unverified", "outline"],
            ].map(([k, label, variant]) => (
              <div key={k as string} className="flex items-center justify-between rounded-md border p-2.5">
                <Badge variant={variant as any} className="text-[10px]">{label}</Badge>
                <span className="text-sm font-medium">{Number(es[k as string] ?? 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">Computed {data?.computed_at ? new Date(data.computed_at).toLocaleString() : "—"}</p>
    </div>
  );
}
