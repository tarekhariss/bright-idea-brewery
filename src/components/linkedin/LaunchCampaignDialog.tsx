import { useState } from "react";
import { Loader2, Rocket, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLaunchCampaign, useValidateWorkflow, useCampaignSenders } from "@/hooks/use-linkedin-workflow";
import { useLinkedinCampaignLeads } from "@/hooks/use-linkedin-campaigns";

export function LaunchCampaignDialog({
  open, onOpenChange, campaignId,
}: { open: boolean; onOpenChange: (v: boolean) => void; campaignId: string }) {
  const { data: validation } = useValidateWorkflow(campaignId);
  const { data: senders } = useCampaignSenders(campaignId);
  const { data: leads } = useLinkedinCampaignLeads(campaignId);
  const launch = useLaunchCampaign();
  const [mode, setMode] = useState<"enroll_existing" | "restart_all" | "only_new">("enroll_existing");

  const hasSenders = (senders ?? []).filter((s) => s.is_active).length > 0;
  const leadCount = leads?.length ?? 0;
  const hasLeads = leadCount > 0;
  const valid = validation?.valid;

  const canLaunch = valid && hasSenders && hasLeads;

  const handleLaunch = async () => {
    const res = await launch.mutateAsync({ campaign_id: campaignId, mode });
    if (res.ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2"><Rocket className="h-4 w-4" /> Launch Campaign</DialogTitle>
          <DialogDescription className="text-xs">Validate and start sending. The execution provider must be configured for actions to actually run.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <ChecklistRow ok={!!valid} label="Workflow is valid">
            {!valid && validation?.errors?.length ? validation.errors.join(" · ") : null}
          </ChecklistRow>
          <ChecklistRow ok={hasSenders} label={`Sender profiles attached (${(senders ?? []).filter((s) => s.is_active).length})`}>
            {!hasSenders ? "Add at least one active sender profile." : null}
          </ChecklistRow>
          <ChecklistRow ok={hasLeads} label={`Leads added (${leadCount})`}>
            {!hasLeads ? "Add at least one contact." : null}
          </ChecklistRow>
        </div>

        {hasLeads && (
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs">What about existing leads?</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)}>
              <label className="flex items-start gap-2 rounded border p-2 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="enroll_existing" id="m1" className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Enroll un-started leads</p>
                  <p className="text-[11px] text-muted-foreground">Schedule the start node for leads that haven't begun yet. Default.</p>
                </div>
              </label>
              <label className="flex items-start gap-2 rounded border p-2 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="restart_all" id="m2" className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Restart all leads from the beginning</p>
                  <p className="text-[11px] text-muted-foreground">Cancels pending actions and re-enrolls every lead at the Start node.</p>
                </div>
              </label>
              <label className="flex items-start gap-2 rounded border p-2 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="only_new" id="m3" className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Don't enroll existing leads</p>
                  <p className="text-[11px] text-muted-foreground">Only leads added after launch will start the workflow.</p>
                </div>
              </label>
            </RadioGroup>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" disabled={!canLaunch || launch.isPending} onClick={handleLaunch} className="gap-1.5">
            {launch.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
            Launch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChecklistRow({ ok, label, children }: { ok: boolean; label: string; children?: React.ReactNode }) {
  return (
    <div className={`flex items-start gap-2 rounded p-2 text-sm ${ok ? "bg-emerald-500/5" : "bg-amber-500/5"}`}>
      <div className={`mt-0.5 h-4 w-4 rounded-full flex items-center justify-center text-[10px] text-white ${ok ? "bg-emerald-600" : "bg-amber-600"}`}>
        {ok ? "✓" : "!"}
      </div>
      <div className="flex-1">
        <p className="font-medium">{label}</p>
        {children && <p className="text-[11px] text-muted-foreground">{children}</p>}
      </div>
    </div>
  );
}
