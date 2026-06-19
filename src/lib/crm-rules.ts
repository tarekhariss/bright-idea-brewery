/**
 * Rule-based CRM helpers. Used everywhere as the deterministic fallback when
 * AI is unavailable, and as the engine for stale detection / smart queues so
 * those features work without consuming AI credits.
 */
import type { Opportunity } from "@/hooks/use-opportunities";

export const TERMINAL = new Set(["won", "lost", "not_fit", "bad_timing"]);

export function isClosed(o: Pick<Opportunity, "status">) {
  return TERMINAL.has(o.status);
}

/** Stale = no activity for staleDays AND not closed AND no future next_action. */
export function isStale(
  o: Pick<Opportunity, "status" | "last_activity_at" | "next_action_at" | "created_at">,
  staleDays: number
): boolean {
  if (isClosed(o as any)) return false;
  const now = Date.now();
  if (o.next_action_at && +new Date(o.next_action_at) > now) return false;
  const anchor = o.last_activity_at ?? o.created_at;
  if (!anchor) return false;
  const ageDays = (now - +new Date(anchor)) / 86_400_000;
  return ageDays >= staleDays;
}

export function daysSinceActivity(o: Pick<Opportunity, "last_activity_at" | "created_at">) {
  const anchor = o.last_activity_at ?? o.created_at;
  if (!anchor) return null;
  return Math.floor((Date.now() - +new Date(anchor)) / 86_400_000);
}

export interface NextBestAction {
  title: string;
  rationale: string;
  cta?: "transition" | "assign" | "task" | "deal" | "close_bad_timing" | "close_not_fit" | "reply";
  to_status?: Opportunity["status"];
}

export function ruleNextBestAction(
  o: Opportunity,
  staleDays: number
): NextBestAction {
  if (isClosed(o)) {
    return { title: "Closed — no action needed", rationale: `Closed as ${o.status}.` };
  }
  if (!o.owner_id) {
    return { title: "Assign an owner", rationale: "Nobody owns this opportunity yet.", cta: "assign" };
  }
  if (isStale(o, staleDays)) {
    return {
      title: "Stale — re-engage or close",
      rationale: `No activity for ${daysSinceActivity(o)}d. Send a break-up note, mark bad_timing, or move on.`,
      cta: "close_bad_timing",
    };
  }
  switch (o.status) {
    case "interested":
      if (!o.next_action_at) {
        return { title: "Schedule a follow-up task", rationale: "Lead is interested but no follow-up is scheduled.", cta: "task" };
      }
      return { title: "Qualify the lead", rationale: "Ask the qualifying questions and move to Qualified.", to_status: "qualified", cta: "transition" };
    case "qualified":
      return { title: "Book a meeting", rationale: "Propose 2 time slots and move status to Meeting requested.", to_status: "meeting_requested", cta: "transition" };
    case "meeting_requested":
      return { title: "Confirm the meeting", rationale: "Chase confirmation; once confirmed, move to Meeting booked.", to_status: "meeting_booked", cta: "transition" };
    case "meeting_booked":
      if (!o.deal_id) {
        return { title: "Create or link a deal", rationale: "Meeting is booked — open a deal so revenue is tracked.", cta: "deal" };
      }
      return { title: "Send proposal / RFQ", rationale: "Move to Proposal once meeting concludes.", to_status: "proposal_rfq", cta: "transition" };
    case "proposal_rfq":
      return { title: "Chase the decision", rationale: "Follow up on the proposal and push for won/lost.", cta: "reply" };
    default:
      return { title: "Review and decide", rationale: "Take the next concrete step." };
  }
}

export type SmartQueueKey =
  | "new_interested"
  | "needs_owner"
  | "no_follow_up"
  | "due_today"
  | "stale"
  | "high_priority"
  | "meetings_booked"
  | "proposal_rfq"
  | "recently_updated";

export interface SmartQueueDef { key: SmartQueueKey; label: string; description: string; }

export const SMART_QUEUES: SmartQueueDef[] = [
  { key: "new_interested",   label: "New Interested",           description: "Status = interested, created in last 7 days." },
  { key: "needs_owner",      label: "Needs Owner",              description: "No owner assigned." },
  { key: "no_follow_up",     label: "No Follow-up Scheduled",   description: "Open and no next_action_at set." },
  { key: "due_today",        label: "Follow-up Due Today",      description: "next_action_at is today (or earlier)." },
  { key: "stale",            label: "Stale Opportunities",      description: "No activity past your stale threshold." },
  { key: "high_priority",    label: "High Priority",            description: "Priority = high or urgent and still open." },
  { key: "meetings_booked",  label: "Meetings Booked",          description: "Status = meeting_booked." },
  { key: "proposal_rfq",     label: "Proposal / RFQ",           description: "Status = proposal_rfq." },
  { key: "recently_updated", label: "Recently Updated",         description: "Activity in the last 24 hours." },
];

export function filterQueue(
  key: SmartQueueKey,
  opportunities: Opportunity[],
  staleDays: number
): Opportunity[] {
  const now = Date.now();
  const startOfTomorrow = new Date(); startOfTomorrow.setHours(24, 0, 0, 0);
  return opportunities.filter((o) => {
    const open = !isClosed(o);
    switch (key) {
      case "new_interested":
        return open && o.status === "interested" && +new Date(o.created_at) > now - 7 * 86_400_000;
      case "needs_owner":      return open && !o.owner_id;
      case "no_follow_up":     return open && !o.next_action_at;
      case "due_today":        return open && !!o.next_action_at && +new Date(o.next_action_at) < startOfTomorrow.getTime();
      case "stale":            return isStale(o, staleDays);
      case "high_priority":    return open && (o.priority === "high" || o.priority === "urgent");
      case "meetings_booked":  return o.status === "meeting_booked";
      case "proposal_rfq":     return o.status === "proposal_rfq";
      case "recently_updated": return !!o.last_activity_at && +new Date(o.last_activity_at) > now - 86_400_000;
    }
  });
}
