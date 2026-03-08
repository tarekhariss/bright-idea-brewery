import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LifecycleStatus, OutreachStatus, EmailValidity } from "@/integrations/supabase/db-types";

const lifecycleConfig: Record<LifecycleStatus, { label: string; className: string }> = {
  new: { label: "New", className: "bg-blue-100 text-blue-700 border-blue-200" },
  researching: { label: "Researching", className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  qualified: { label: "Qualified", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  nurturing: { label: "Nurturing", className: "bg-amber-100 text-amber-700 border-amber-200" },
  engaged: { label: "Engaged", className: "bg-violet-100 text-violet-700 border-violet-200" },
  converted: { label: "Converted", className: "bg-green-100 text-green-800 border-green-200" },
  churned: { label: "Churned", className: "bg-red-100 text-red-700 border-red-200" },
  archived: { label: "Archived", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

const outreachConfig: Record<OutreachStatus, { label: string; className: string }> = {
  not_contacted: { label: "Not Contacted", className: "bg-gray-100 text-gray-600 border-gray-200" },
  queued: { label: "Queued", className: "bg-sky-100 text-sky-700 border-sky-200" },
  contacted: { label: "Contacted", className: "bg-blue-100 text-blue-700 border-blue-200" },
  replied: { label: "Replied", className: "bg-green-100 text-green-700 border-green-200" },
  bounced: { label: "Bounced", className: "bg-orange-100 text-orange-700 border-orange-200" },
  opted_out: { label: "Opted Out", className: "bg-red-100 text-red-700 border-red-200" },
  unresponsive: { label: "Unresponsive", className: "bg-gray-100 text-gray-500 border-gray-200" },
};

const emailValidityConfig: Record<EmailValidity, { label: string; className: string }> = {
  unknown: { label: "Unknown", className: "bg-gray-100 text-gray-600 border-gray-200" },
  valid: { label: "Valid", className: "bg-green-100 text-green-700 border-green-200" },
  invalid: { label: "Invalid", className: "bg-red-100 text-red-700 border-red-200" },
  catch_all: { label: "Catch-all", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  disposable: { label: "Disposable", className: "bg-orange-100 text-orange-700 border-orange-200" },
  role_based: { label: "Role-based", className: "bg-purple-100 text-purple-700 border-purple-200" },
};

export function LifecycleBadge({ status }: { status: LifecycleStatus }) {
  const c = lifecycleConfig[status];
  return <Badge variant="outline" className={cn("text-[11px] font-medium", c.className)}>{c.label}</Badge>;
}

export function OutreachBadge({ status }: { status: OutreachStatus }) {
  const c = outreachConfig[status];
  return <Badge variant="outline" className={cn("text-[11px] font-medium", c.className)}>{c.label}</Badge>;
}

export function EmailValidityBadge({ status }: { status: EmailValidity }) {
  const c = emailValidityConfig[status];
  return <Badge variant="outline" className={cn("text-[11px] font-medium", c.className)}>{c.label}</Badge>;
}

export function QualityScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground text-xs">—</span>;
  const className = score >= 70
    ? "bg-green-100 text-green-700 border-green-200"
    : score >= 40
    ? "bg-yellow-100 text-yellow-700 border-yellow-200"
    : "bg-red-100 text-red-700 border-red-200";
  return <Badge variant="outline" className={cn("text-[11px] font-medium tabular-nums", className)}>{score}</Badge>;
}

export function DncBadge({ dnc }: { dnc: boolean }) {
  if (!dnc) return null;
  return <Badge variant="outline" className="text-[11px] font-medium bg-red-100 text-red-700 border-red-200">DNC</Badge>;
}
