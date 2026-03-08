import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Inbox, Globe, Mail, Plus, Shield, CheckCircle2, XCircle, Clock,
  ArrowRight, BarChart3, Zap, AlertTriangle, Activity, Server,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface SetupStep {
  title: string;
  desc: string;
  done: boolean;
  icon: typeof Globe;
  action: string;
  route: string;
}

export default function DeliverabilityOverview() {
  const navigate = useNavigate();

  // These would come from DB once domains/mailboxes tables exist.
  // For now, read from localStorage to persist across page loads.
  const storedDomains = JSON.parse(localStorage.getItem("lb_domains") || "[]");
  const storedMailboxes = JSON.parse(localStorage.getItem("lb_mailboxes") || "[]");

  const domainCount = storedDomains.length;
  const mailboxCount = storedMailboxes.length;
  const verifiedDomains = storedDomains.filter((d: any) => d.status === "verified").length;
  const activeMailboxes = storedMailboxes.filter((m: any) => m.status === "active").length;
  const warmingMailboxes = storedMailboxes.filter((m: any) => m.warmup_status === "active").length;

  const stats = [
    { label: "Domains", value: `${verifiedDomains}/${domainCount}`, sub: "verified", icon: Globe, color: "text-blue-500 bg-blue-500/10" },
    { label: "Mailboxes", value: `${activeMailboxes}/${mailboxCount}`, sub: "active", icon: Inbox, color: "text-emerald-500 bg-emerald-500/10" },
    { label: "Warmup", value: warmingMailboxes > 0 ? `${warmingMailboxes} warming` : "Not started", sub: "", icon: Zap, color: "text-amber-500 bg-amber-500/10" },
    { label: "Sending Health", value: mailboxCount > 0 ? "Monitoring" : "No data", sub: "", icon: Activity, color: "text-violet-500 bg-violet-500/10" },
  ];

  const setupSteps: SetupStep[] = [
    { title: "Add a sending domain", desc: "Authenticate your domain with SPF, DKIM, and DMARC to improve inbox placement.", done: domainCount > 0, icon: Globe, action: "Add Domain", route: "/settings/workspace/deliverability/domains" },
    { title: "Connect a mailbox", desc: "Link your email via SMTP/IMAP or OAuth to start sending from the platform.", done: mailboxCount > 0, icon: Mail, action: "Add Mailbox", route: "/settings/workspace/deliverability/mailboxes" },
    { title: "Enable warmup", desc: "Gradually increase sending volume to build sender reputation.", done: warmingMailboxes > 0, icon: Zap, action: "Configure", route: "/settings/workspace/deliverability/mailboxes" },
    { title: "Verify DNS records", desc: "Ensure all DNS records are correctly configured for maximum deliverability.", done: verifiedDomains > 0, icon: Shield, action: "Check DNS", route: "/settings/workspace/deliverability/domains" },
  ];

  const completedSteps = setupSteps.filter((s) => s.done).length;
  const progressPercent = (completedSteps / setupSteps.length) * 100;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Server className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deliverability Suite</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage domains, mailboxes, and sending infrastructure to maximize inbox placement.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground truncate">{s.label}</p>
                <p className="text-lg font-semibold leading-tight">{s.value}</p>
                {s.sub && <p className="text-[10px] text-muted-foreground">{s.sub}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Setup Progress */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Mail className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-semibold">Setup Progress</h3>
                <span className="text-xs text-muted-foreground">{completedSteps}/{setupSteps.length} complete</span>
              </div>
              <Progress value={progressPercent} className="h-2 mb-4" />
              <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                {completedSteps === setupSteps.length
                  ? "🎉 Your sending infrastructure is fully configured! Monitor your health metrics above."
                  : "Complete the setup checklist below to power sequences, emails, and all engagement features."}
              </p>
              <div className="flex items-center gap-2 mt-4">
                <Button size="sm" className="text-xs gap-1.5" onClick={() => navigate("/settings/workspace/deliverability/domains")}>
                  <Globe className="h-3.5 w-3.5" /> Domains
                </Button>
                <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => navigate("/settings/workspace/deliverability/mailboxes")}>
                  <Inbox className="h-3.5 w-3.5" /> Mailboxes
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Setup Checklist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Setup Checklist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {setupSteps.map((step, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate(step.route)}
            >
              <div className="mt-0.5">
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${step.done ? "line-through text-muted-foreground" : ""}`}>{step.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
              </div>
              <Button size="sm" variant="ghost" className="text-xs h-7 gap-1 shrink-0">
                {step.action} <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <Globe className="h-5 w-5 text-blue-500 mb-3" />
            <h4 className="text-sm font-semibold">Domain Authentication</h4>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              SPF, DKIM, and DMARC records signal to email providers that your messages are legitimate, preventing them from landing in spam.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Mail className="h-5 w-5 text-emerald-500 mb-3" />
            <h4 className="text-sm font-semibold">Mailbox Setup</h4>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Connect via SMTP/IMAP with your email provider credentials. Support for Google Workspace, Microsoft 365, and any SMTP provider.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Zap className="h-5 w-5 text-amber-500 mb-3" />
            <h4 className="text-sm font-semibold">Warmup & Health</h4>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Gradually increase sending volume to build sender reputation. Monitor bounce rates, spam reports, and inbox placement.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
