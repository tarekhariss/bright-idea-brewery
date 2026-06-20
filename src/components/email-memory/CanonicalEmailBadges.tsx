/**
 * Email Verification Memory badges (Phase 1A — intelligence_v2).
 * Renders the canonical deliverability status and modifier-flag chips that are
 * cached on the contact row by the verification-memory projection function.
 */
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, Mail, Ban, AlertTriangle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type CanonicalEmailStatus =
  | "valid" | "valid_catch_all" | "risky" | "unknown"
  | "invalid" | "bounced" | "suppressed" | "unverified";

const STATUS_META: Record<CanonicalEmailStatus, { label: string; tone: string; Icon: any }> = {
  valid:           { label: "Valid",           tone: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", Icon: ShieldCheck },
  valid_catch_all: { label: "Catch-all",       tone: "bg-amber-500/15 text-amber-500 border-amber-500/30",       Icon: ShieldAlert },
  risky:           { label: "Risky",           tone: "bg-amber-500/15 text-amber-500 border-amber-500/30",       Icon: AlertTriangle },
  unknown:         { label: "Unknown",         tone: "bg-muted text-muted-foreground border-border",             Icon: ShieldQuestion },
  invalid:         { label: "Invalid",         tone: "bg-rose-500/15 text-rose-500 border-rose-500/30",          Icon: ShieldX },
  bounced:         { label: "Bounced",         tone: "bg-rose-500/15 text-rose-500 border-rose-500/30",          Icon: Mail },
  suppressed:      { label: "Suppressed",      tone: "bg-rose-500/15 text-rose-500 border-rose-500/30",          Icon: Ban },
  unverified:      { label: "Unverified",      tone: "bg-muted text-muted-foreground border-border",             Icon: HelpCircle },
};

interface Contact {
  email_canonical_status?: CanonicalEmailStatus | null;
  email_status_source?: string | null;
  email_status_verified_at?: string | null;
  email_status_updated_at?: string | null;
  email_is_role_based?: boolean | null;
  email_is_disposable?: boolean | null;
  email_is_free_email?: boolean | null;
  email_is_catch_all?: boolean | null;
  email_is_syntax_invalid?: boolean | null;
  email_is_mx_missing?: boolean | null;
  email_is_temporary_failure?: boolean | null;
}

export function CanonicalStatusBadge({ contact, size = "sm" }: { contact: Contact; size?: "xs" | "sm" }) {
  const status = (contact.email_canonical_status ?? "unverified") as CanonicalEmailStatus;
  const meta = STATUS_META[status] ?? STATUS_META.unverified;
  const cls = size === "xs" ? "text-[10px] py-0 px-1.5 h-4" : "text-[10.5px]";
  const verified = contact.email_status_verified_at ? new Date(contact.email_status_verified_at).toLocaleDateString() : null;
  const source = contact.email_status_source ?? "—";
  return (
    <TooltipProvider>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn("inline-flex items-center gap-1 border", meta.tone, cls)}>
            <meta.Icon className="h-3 w-3" />
            <span>{meta.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="text-xs">
          <div className="font-medium">{meta.label}</div>
          <div className="text-muted-foreground">Source: {source}</div>
          {verified && <div className="text-muted-foreground">Verified: {verified}</div>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const MODIFIER_LABELS: Array<[keyof Contact, string, string]> = [
  ["email_is_role_based",       "Role-based",      "bg-sky-500/10 text-sky-500 border-sky-500/30"],
  ["email_is_disposable",       "Disposable",      "bg-rose-500/10 text-rose-500 border-rose-500/30"],
  ["email_is_free_email",       "Free-email",      "bg-slate-500/10 text-slate-400 border-slate-500/30"],
  ["email_is_catch_all",        "Catch-all",       "bg-amber-500/10 text-amber-500 border-amber-500/30"],
  ["email_is_syntax_invalid",   "Syntax invalid",  "bg-rose-500/10 text-rose-500 border-rose-500/30"],
  ["email_is_mx_missing",       "MX missing",      "bg-rose-500/10 text-rose-500 border-rose-500/30"],
  ["email_is_temporary_failure","Temp failure",    "bg-amber-500/10 text-amber-500 border-amber-500/30"],
];

export function ModifierChips({ contact, max }: { contact: Contact; max?: number }) {
  const active = MODIFIER_LABELS.filter(([k]) => !!contact[k]);
  if (!active.length) return null;
  const shown = max ? active.slice(0, max) : active;
  const overflow = max && active.length > max ? active.length - max : 0;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {shown.map(([k, label, tone]) => (
        <Badge key={String(k)} variant="outline" className={cn("text-[9.5px] py-0 px-1.5 h-4 border", tone)}>
          {label}
        </Badge>
      ))}
      {overflow > 0 && (
        <Badge variant="outline" className="text-[9.5px] py-0 px-1.5 h-4">+{overflow}</Badge>
      )}
    </span>
  );
}

export const CANONICAL_STATUS_OPTIONS = (Object.keys(STATUS_META) as CanonicalEmailStatus[])
  .map(v => ({ value: v, label: STATUS_META[v].label }));
