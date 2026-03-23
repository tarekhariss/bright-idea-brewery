import { useState } from "react";
import {
  Plug, Mail, Linkedin, Server, Plus, CheckCircle2, XCircle,
  Clock, AlertTriangle, RefreshCw, Loader2, ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useProviderConnections, ProviderType } from "@/hooks/use-provider-connections";
import { GoogleConnectionWizard } from "@/components/providers/GoogleConnectionWizard";
import { OutlookConnectionWizard } from "@/components/providers/OutlookConnectionWizard";
import { SmtpConnectionWizard } from "@/components/providers/SmtpConnectionWizard";
import { LinkedInConnectionWizard } from "@/components/providers/LinkedInConnectionWizard";

const providers: { type: ProviderType; label: string; description: string; icon: any; color: string }[] = [
  { type: "google", label: "Google Workspace", description: "Connect Gmail & Google Workspace accounts via OAuth", icon: Mail, color: "bg-red-500/10 text-red-600" },
  { type: "microsoft", label: "Outlook / Microsoft 365", description: "Connect Outlook & Microsoft 365 accounts via OAuth", icon: Mail, color: "bg-blue-500/10 text-blue-600" },
  { type: "smtp", label: "SMTP Provider", description: "Connect Mailgun, SendGrid, Amazon SES, or custom SMTP", icon: Server, color: "bg-emerald-500/10 text-emerald-600" },
  { type: "linkedin", label: "LinkedIn", description: "Connect LinkedIn profiles for multichannel outreach", icon: Linkedin, color: "bg-sky-500/10 text-sky-600" },
];

const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
  connected: { label: "Connected", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  disconnected: { label: "Disconnected", icon: XCircle, className: "bg-muted text-muted-foreground" },
  needs_reauth: { label: "Needs Reauth", icon: AlertTriangle, className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  invalid_credentials: { label: "Invalid", icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
  pending: { label: "Pending", icon: Clock, className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
};

export default function ProviderConnectionsPage() {
  const { data: connections, isLoading } = useProviderConnections();
  const [wizardOpen, setWizardOpen] = useState<ProviderType | null>(null);

  const getProviderStats = (type: ProviderType) => {
    const filtered = connections?.filter((c) => c.provider_type === type) || [];
    const connected = filtered.filter((c) => c.connection_status === "connected").length;
    const lastValidated = filtered
      .filter((c) => c.last_validated_at)
      .sort((a, b) => new Date(b.last_validated_at!).getTime() - new Date(a.last_validated_at!).getTime())[0]
      ?.last_validated_at;
    return { total: filtered.length, connected, lastValidated };
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Plug className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Provider Connections</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect email and LinkedIn providers for outbound sending and automation.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {providers.map((p) => {
            const stats = getProviderStats(p.type);
            const Icon = p.icon;
            return (
              <Card key={p.type} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => setWizardOpen(p.type)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${p.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">{p.label}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors mt-1" />
                  </div>

                  <div className="mt-4 flex items-center gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Accounts</p>
                      <p className="text-lg font-semibold">{stats.total}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Connected</p>
                      <p className="text-lg font-semibold text-emerald-600">{stats.connected}</p>
                    </div>
                    <div className="flex-1 text-right">
                      {stats.lastValidated ? (
                        <p className="text-[10px] text-muted-foreground">
                          Last checked {new Date(stats.lastValidated).toLocaleDateString()}
                        </p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">Not validated</p>
                      )}
                    </div>
                  </div>

                  {stats.total > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(connections?.filter((c) => c.provider_type === p.type) || []).slice(0, 3).map((c) => {
                        const sc = statusConfig[c.connection_status] || statusConfig.pending;
                        const StatusIcon = sc.icon;
                        return (
                          <Badge key={c.id} className={`text-[10px] gap-1 ${sc.className}`}>
                            <StatusIcon className="h-2.5 w-2.5" />
                            {c.account_email || c.display_name || c.from_email || "Account"}
                          </Badge>
                        );
                      })}
                      {stats.total > 3 && (
                        <Badge variant="secondary" className="text-[10px]">+{stats.total - 3} more</Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Wizards */}
      <GoogleConnectionWizard open={wizardOpen === "google"} onClose={() => setWizardOpen(null)} />
      <OutlookConnectionWizard open={wizardOpen === "microsoft"} onClose={() => setWizardOpen(null)} />
      <SmtpConnectionWizard open={wizardOpen === "smtp"} onClose={() => setWizardOpen(null)} />
      <LinkedInConnectionWizard open={wizardOpen === "linkedin"} onClose={() => setWizardOpen(null)} />
    </div>
  );
}
