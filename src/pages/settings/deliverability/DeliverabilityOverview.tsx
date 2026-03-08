import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Inbox, Globe, Mail, Plus, Shield, CheckCircle2, XCircle, Clock,
  ArrowRight, BarChart3, Zap, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const stats = [
  { label: "Linked Domains", value: "0", icon: Globe, color: "text-blue-500 bg-blue-500/10" },
  { label: "Linked Mailboxes", value: "0", icon: Inbox, color: "text-emerald-500 bg-emerald-500/10" },
  { label: "Warmup Status", value: "Not started", icon: Zap, color: "text-amber-500 bg-amber-500/10" },
  { label: "Sending Health", value: "No data", icon: BarChart3, color: "text-violet-500 bg-violet-500/10" },
];

const setupSteps = [
  { title: "Add a sending domain", desc: "Authenticate your domain with SPF, DKIM, and DMARC to improve inbox placement.", done: false, icon: Globe },
  { title: "Connect a mailbox", desc: "Link your email via SMTP/IMAP or OAuth to start sending from the platform.", done: false, icon: Mail },
  { title: "Enable warmup", desc: "Gradually increase sending volume to build sender reputation.", done: false, icon: Zap },
  { title: "Verify DNS records", desc: "Ensure all DNS records are correctly configured for maximum deliverability.", done: false, icon: Shield },
];

export default function DeliverabilityOverview() {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Inbox className="h-5 w-5" />
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
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Onboarding Banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Mail className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold">Link your mailbox to get started</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-2xl">
                Set up your sending infrastructure to power sequences, conversations, meetings, and other engagement features. Proper domain authentication and mailbox warmup dramatically improve your deliverability.
              </p>
              <div className="flex items-center gap-2 mt-4">
                <Button size="sm" className="text-xs gap-1.5" onClick={() => navigate("/settings/workspace/deliverability/domains")}>
                  <Globe className="h-3.5 w-3.5" /> Add Domain
                </Button>
                <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => navigate("/settings/workspace/deliverability/mailboxes")}>
                  <Plus className="h-3.5 w-3.5" /> Add Mailbox
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
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="mt-0.5">
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Why It Matters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <Globe className="h-5 w-5 text-blue-500 mb-3" />
            <h4 className="text-sm font-semibold">Why Domains Matter</h4>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Authenticated domains with proper SPF, DKIM, and DMARC records signal to email providers that your messages are legitimate, preventing them from landing in spam.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Mail className="h-5 w-5 text-emerald-500 mb-3" />
            <h4 className="text-sm font-semibold">Why Mailboxes Matter</h4>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Dedicated mailboxes with proper warmup allow you to scale sending volume while maintaining high deliverability and sender reputation scores.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Zap className="h-5 w-5 text-amber-500 mb-3" />
            <h4 className="text-sm font-semibold">Powers Everything</h4>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Your sending infrastructure powers sequences, one-off emails, meeting scheduling, and conversation tracking — the foundation of all outbound engagement.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
