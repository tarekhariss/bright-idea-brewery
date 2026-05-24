import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";
import { useCampaignSafety } from "@/hooks/use-verification-platform";

interface Props {
  campaignId: string;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function CampaignSafetyDialog({ campaignId, open, onClose, onConfirm }: Props) {
  const { data: safety, isLoading } = useCampaignSafety(open ? campaignId : null);
  const [acknowledged, setAcknowledged] = useState(false);

  const warnings: string[] = safety?.warnings ?? [];
  const blocks = warnings.filter((w) => w.startsWith("blocked:"));
  const reviews = warnings.filter((w) => !w.startsWith("blocked:"));
  const isBlocked = !!safety?.blocked || blocks.length > 0;
  const needsApproval = !isBlocked && reviews.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isBlocked ? <ShieldAlert className="h-5 w-5 text-rose-500" /> : <ShieldCheck className="h-5 w-5 text-emerald-500" />}
            Pre-launch verification check
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking enrolled contacts…
          </div>
        ) : !safety ? (
          <p className="py-6 text-sm text-muted-foreground">No data.</p>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-4 gap-2 text-xs">
              {[
                ["Total", safety.total ?? 0],
                ["Invalid", safety.invalid ?? 0],
                ["Disposable", safety.disposable ?? 0],
                ["Suppressed", safety.suppressed ?? 0],
                ["Unknown", safety.unknown ?? 0],
                ["Risk", safety.risk_score ?? "—"],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-md border bg-card/40 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</div>
                  <div className="text-sm font-semibold tabular-nums">{v as any}</div>
                </div>
              ))}
            </div>

            {blocks.length > 0 && (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3">
                <div className="mb-1 text-xs font-semibold text-rose-500">Cannot launch — hard blocks:</div>
                <ul className="space-y-0.5 text-xs text-rose-500">
                  {blocks.map((w, i) => <li key={i}>• {w.replace(/^blocked:/, "")}</li>)}
                </ul>
              </div>
            )}

            {reviews.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="mb-1 text-xs font-semibold text-amber-500">Warnings — manual approval required:</div>
                <ul className="space-y-0.5 text-xs text-amber-600">
                  {reviews.map((w, i) => <li key={i}>• {w}</li>)}
                </ul>
              </div>
            )}

            {!isBlocked && reviews.length === 0 && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-600">
                All checks passed. Safe to launch.
              </div>
            )}

            {needsApproval && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={acknowledged} onCheckedChange={(c) => setAcknowledged(!!c)} />
                I accept the deliverability risk and approve launching this campaign.
              </label>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={isBlocked || (needsApproval && !acknowledged) || isLoading}
            onClick={() => { onConfirm(); onClose(); }}
          >
            {isBlocked ? "Blocked" : "Launch campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
