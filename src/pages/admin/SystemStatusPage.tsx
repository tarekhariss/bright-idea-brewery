/**
 * Admin System Status — shows background job readiness, provider integration status, and module state.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2, XCircle, AlertTriangle, Clock, Server,
  Mail, Zap, Database, BarChart3, Users, Shield,
} from "lucide-react";

interface StatusItem {
  name: string;
  category: string;
  status: "ready" | "needs_setup" | "mock" | "partial";
  description: string;
}

const SYSTEM_STATUS: StatusItem[] = [
  // Background Jobs
  { name: "Email Queue Processor", category: "Background Jobs", status: "ready", description: "Edge function deployed. Needs pg_cron trigger to auto-process." },
  { name: "Campaign Step Processor", category: "Background Jobs", status: "ready", description: "Edge function deployed. Needs pg_cron trigger to auto-execute steps." },
  { name: "Export Job Processor", category: "Background Jobs", status: "ready", description: "Edge function deployed. Invoked on-demand from frontend for large exports." },
  { name: "Dedup Scan Processor", category: "Background Jobs", status: "ready", description: "Edge function deployed. Invoked on-demand from frontend." },
  { name: "Background Jobs Aggregator", category: "Background Jobs", status: "ready", description: "Edge function deployed. Needs pg_cron trigger for periodic KPI refresh." },
  { name: "pg_cron Scheduling", category: "Background Jobs", status: "needs_setup", description: "Cron triggers not yet configured. Need INSERT into cron.schedule for each job." },

  // Email & Sending
  { name: "Email Templates & Variants", category: "Email System", status: "ready", description: "Full CRUD with workspace scoping." },
  { name: "Mailbox Management", category: "Email System", status: "ready", description: "CRUD with SMTP config, domain linking, daily limits." },
  { name: "Send Email (SMTP)", category: "Email System", status: "partial", description: "Edge function ready. Requires SMTP secrets per mailbox (SMTP_PASS_{id})." },
  { name: "Mock Send", category: "Email System", status: "ready", description: "Client-side mock send flow fully functional." },
  { name: "Sending Windows", category: "Email System", status: "ready", description: "CRUD for time-based send windows." },
  { name: "ESP Routing Rules", category: "Email System", status: "ready", description: "Priority-based routing rule CRUD." },
  { name: "Inbox Threads", category: "Email System", status: "partial", description: "Schema and UI ready. Needs IMAP sync integration." },

  // Deliverability
  { name: "Domain Verification", category: "Deliverability", status: "partial", description: "Schema ready. DNS verification logic not automated." },
  { name: "Mailbox Health Tracking", category: "Deliverability", status: "ready", description: "Health metrics table and UI ready." },
  { name: "Contact Suppression", category: "Deliverability", status: "ready", description: "Workspace-scoped suppression CRUD." },
  { name: "Domain Suppression", category: "Deliverability", status: "ready", description: "Workspace-scoped domain blocking." },
  { name: "Warmup Settings", category: "Deliverability", status: "ready", description: "Per-mailbox warmup configuration." },

  // LinkedIn
  { name: "LinkedIn Accounts", category: "LinkedIn", status: "ready", description: "CRUD with health tracking." },
  { name: "LinkedIn Action Queue", category: "LinkedIn", status: "partial", description: "Schema and read UI ready. No automation agent." },
  { name: "LinkedIn Safety Rules", category: "LinkedIn", status: "ready", description: "Workspace-scoped rate limiting." },

  // Data Tools
  { name: "CSV Import (chunked)", category: "Data Tools", status: "ready", description: "Client-side chunked import with mapping, dedup, retry." },
  { name: "Server-side Export", category: "Data Tools", status: "ready", description: "Edge function with progress tracking for 100k+ rows." },
  { name: "Server-side Dedup Scan", category: "Data Tools", status: "ready", description: "Edge function with chunked scanning, confidence scoring." },
  { name: "Merge Engine", category: "Data Tools", status: "ready", description: "Field-level merge with history and audit trail." },
  { name: "Bulk Update", category: "Data Tools", status: "ready", description: "Multi-field bulk update with workspace scoping." },
  { name: "Dynamic Lists", category: "Data Tools", status: "ready", description: "Rule-based lists with include/exclude logic." },

  // Campaigns
  { name: "Campaign CRUD", category: "Campaigns", status: "ready", description: "Full lifecycle with workspace scoping." },
  { name: "Multi-step Workflows", category: "Campaigns", status: "ready", description: "Email, LinkedIn, Task step types." },
  { name: "Enrollment Engine", category: "Campaigns", status: "ready", description: "Contact enrollment with step execution tracking." },

  // Analytics
  { name: "Campaign Performance", category: "Analytics", status: "ready", description: "Per-campaign metrics tracking." },
  { name: "Revenue Attribution", category: "Analytics", status: "ready", description: "First/last/multi-touch attribution models." },
  { name: "Workspace KPIs", category: "Analytics", status: "partial", description: "Schema ready. Needs background aggregation job trigger." },
  { name: "Admin Platform KPIs", category: "Analytics", status: "partial", description: "Schema ready. Needs background aggregation job trigger." },

  // Provider Connections
  { name: "Google OAuth", category: "Providers", status: "needs_setup", description: "UI wizard built. Needs Google OAuth credentials." },
  { name: "Outlook/Microsoft", category: "Providers", status: "needs_setup", description: "UI wizard built. Needs Microsoft app credentials." },
  { name: "SMTP Provider", category: "Providers", status: "partial", description: "Config UI ready. Needs per-mailbox SMTP secrets." },
  { name: "Connection Validation", category: "Providers", status: "mock", description: "Currently uses random mock validation. Needs real provider checks." },

  // Security
  { name: "Workspace Isolation (hooks)", category: "Security", status: "ready", description: "All hooks scoped by workspace_id." },
  { name: "RLS Policies", category: "Security", status: "partial", description: "Most tables have RLS. Some use broad USING(true) policies." },
  { name: "Role-based Access", category: "Security", status: "ready", description: "admin/manager/operator/viewer roles with workspace_members." },
];

const STATUS_CONFIG = {
  ready: { icon: CheckCircle2, label: "Ready", className: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
  partial: { icon: AlertTriangle, label: "Partial", className: "bg-amber-500/10 text-amber-600 border-amber-200" },
  needs_setup: { icon: Clock, label: "Needs Setup", className: "bg-primary/10 text-primary border-primary/20" },
  mock: { icon: XCircle, label: "Mock Only", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const CATEGORY_ICONS: Record<string, any> = {
  "Background Jobs": Server,
  "Email System": Mail,
  "Deliverability": Shield,
  "LinkedIn": Users,
  "Data Tools": Database,
  "Campaigns": Zap,
  "Analytics": BarChart3,
  "Providers": Mail,
  "Security": Shield,
};

export default function SystemStatusPage() {
  const categories = [...new Set(SYSTEM_STATUS.map((s) => s.category))];
  const readyCount = SYSTEM_STATUS.filter((s) => s.status === "ready").length;
  const partialCount = SYSTEM_STATUS.filter((s) => s.status === "partial").length;
  const needsSetupCount = SYSTEM_STATUS.filter((s) => s.status === "needs_setup").length;
  const mockCount = SYSTEM_STATUS.filter((s) => s.status === "mock").length;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System Status</h1>
        <p className="text-sm text-muted-foreground">Production readiness overview of all platform modules</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Ready", value: readyCount, color: "text-emerald-600" },
          { label: "Partial", value: partialCount, color: "text-amber-600" },
          { label: "Needs Setup", value: needsSetupCount, color: "text-primary" },
          { label: "Mock Only", value: mockCount, color: "text-destructive" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* By Category */}
      {categories.map((cat) => {
        const items = SYSTEM_STATUS.filter((s) => s.category === cat);
        const CatIcon = CATEGORY_ICONS[cat] ?? Server;
        return (
          <Card key={cat}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CatIcon className="h-4 w-4 text-muted-foreground" />
                {cat}
                <Badge variant="outline" className="ml-auto text-xs">
                  {items.filter((i) => i.status === "ready").length}/{items.length} ready
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold">Module</TableHead>
                    <TableHead className="font-semibold w-[120px]">Status</TableHead>
                    <TableHead className="font-semibold">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const cfg = STATUS_CONFIG[item.status];
                    const Icon = cfg.icon;
                    return (
                      <TableRow key={item.name}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs gap-1 ${cfg.className}`}>
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.description}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
