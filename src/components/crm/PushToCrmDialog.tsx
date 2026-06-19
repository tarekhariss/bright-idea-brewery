/**
 * PushToCrmDialog — shared modal used by every "Push to CRM" entry point.
 *
 * Every submission goes through the push_to_crm RPC, which handles dedupe,
 * smart owner fallback, status history, optional note/task/deal, and
 * activity logging atomically.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { pushToCrm, type PushToCrmPayload, type OpportunityStatus, type OpportunityPriority, type OpportunitySourceChannel } from "@/hooks/use-opportunities";

export interface PushToCrmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId?: string | null;
  companyId?: string | null;
  sourceThreadId?: string | null;
  sourceThreadType?: "email" | "linkedin" | null;
  sourceCampaignId?: string | null;
  sourceCampaignType?: "email" | "linkedin" | null;
  sourceMessageId?: string | null;
  sourceChannel?: OpportunitySourceChannel;
  defaultStatus?: OpportunityStatus;
  defaultTitle?: string;
  navigateOnSuccess?: boolean;
  /** When set, the resulting opportunity is linked to this existing deal (overrides "create deal"). */
  linkDealId?: string | null;
  onPushed?: (opportunityId: string, created: boolean) => void;
}

const STATUS_OPTIONS: { value: OpportunityStatus; label: string }[] = [
  { value: "interested", label: "Interested" },
  { value: "qualified", label: "Qualified" },
  { value: "meeting_requested", label: "Meeting requested" },
  { value: "meeting_booked", label: "Meeting booked" },
  { value: "proposal_rfq", label: "Proposal / RFQ" },
];

const PRIORITY_OPTIONS: { value: OpportunityPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function PushToCrmDialog(props: PushToCrmDialogProps) {
  const { open, onOpenChange, contactId, companyId, sourceThreadId, sourceThreadType,
    sourceCampaignId, sourceCampaignType, sourceMessageId, sourceChannel,
    defaultStatus, defaultTitle, navigateOnSuccess, linkDealId, onPushed } = props;
  const { workspaceId } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<OpportunityStatus>(defaultStatus ?? "interested");
  const [priority, setPriority] = useState<OpportunityPriority>("normal");
  const [title, setTitle] = useState<string>(defaultTitle ?? "");
  const [note, setNote] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [createDeal, setCreateDeal] = useState(false);
  const [dealValue, setDealValue] = useState<string>("");
  const [forceNew, setForceNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStatus(defaultStatus ?? "interested");
      setPriority("normal");
      setTitle(defaultTitle ?? "");
      setNote(""); setTaskTitle(""); setTaskDue("");
      setCreateDeal(false); setDealValue(""); setForceNew(false);
    }
  }, [open, defaultStatus, defaultTitle]);

  const canSubmit = useMemo(() => !!(contactId || companyId) && !submitting, [contactId, companyId, submitting]);

  async function handleSubmit() {
    if (!workspaceId || !canSubmit) return;
    setSubmitting(true);
    const payload: PushToCrmPayload = {
      contact_id: contactId ?? null,
      company_id: companyId ?? null,
      source_channel: sourceChannel,
      source_thread_id: sourceThreadId ?? null,
      source_thread_type: sourceThreadType ?? null,
      source_campaign_id: sourceCampaignId ?? null,
      source_campaign_type: sourceCampaignType ?? null,
      source_message_id: sourceMessageId ?? null,
      status, priority,
      title: title.trim() || null,
      note: note.trim() || null,
      next_task: taskTitle.trim() ? { title: taskTitle.trim(), due_at: taskDue || null } : null,
      deal: createDeal ? { create: true, value: dealValue ? Number(dealValue) : null, name: title.trim() || null } : null,
      force_create_new: forceNew,
    };
    const result = await pushToCrm(workspaceId, payload);
    if (result && linkDealId) {
      await (supabase as any)
        .from("opportunities")
        .update({ deal_id: linkDealId })
        .eq("id", result.opportunity_id);
    }
    setSubmitting(false);
    if (result) {
      onPushed?.(result.opportunity_id, result.created);
      onOpenChange(false);
      if (navigateOnSuccess) navigate(`/crm/opportunities/${result.opportunity_id}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Push to CRM</DialogTitle>
          <DialogDescription>
            Create or update an opportunity for this contact / account. Dedupes by thread, campaign,
            and recent open opportunities in the last 30 days.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional short label" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as OpportunityStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as OpportunityPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Context, intent, next steps…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Next task</Label>
              <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g. Send proposal" />
            </div>
            <div className="space-y-1">
              <Label>Due</Label>
              <Input type="datetime-local" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
            </div>
          </div>

          <div className="rounded-md border p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={createDeal} onCheckedChange={(v) => setCreateDeal(!!v)} />
              Create / link a deal
            </label>
            {createDeal && (
              <div className="space-y-1">
                <Label className="text-xs">Deal value</Label>
                <Input type="number" inputMode="decimal" value={dealValue} onChange={(e) => setDealValue(e.target.value)} placeholder="0.00" />
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={forceNew} onCheckedChange={(v) => setForceNew(!!v)} />
            Force create a new opportunity (skip dedupe)
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Pushing…" : "Push to CRM"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
