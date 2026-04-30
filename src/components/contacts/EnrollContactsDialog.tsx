/**
 * EnrollContactsDialog — pick a campaign or sequence and enroll selected contacts.
 * Uses real RPC / inserts (no fake state).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactIds: string[];
  workspaceId: string;
  defaultTarget?: "campaign" | "linkedin_campaign";
  onSuccess?: () => void;
}

export function EnrollContactsDialog({ open, onOpenChange, contactIds, workspaceId, defaultTarget = "campaign", onSuccess }: Props) {
  const { user } = useAuth();
  const [target, setTarget] = useState<"campaign" | "linkedin_campaign">(defaultTarget);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([]);
  const [liCampaigns, setLiCampaigns] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedId("");
    (async () => {
      const [{ data: c }, { data: lc }] = await Promise.all([
        supabase.from("campaigns").select("id, name").eq("workspace_id", workspaceId).in("status", ["active","draft","paused"]).order("name"),
        supabase.from("linkedin_campaigns").select("id, name").eq("workspace_id", workspaceId).in("status", ["active","draft","paused"]).order("name"),
      ]);
      setCampaigns((c ?? []) as any);
      setLiCampaigns((lc ?? []) as any);
    })();
  }, [open, workspaceId]);

  async function handleEnroll() {
    if (!selectedId) { toast.error("Pick a campaign"); return; }
    setBusy(true);
    try {
      if (target === "campaign") {
        // Email campaign: insert into campaign_enrollments (idempotent on campaign_id+contact_id)
        const rows = contactIds.map(cid => ({
          campaign_id: selectedId, contact_id: cid, status: "active" as const,
          workspace_id: workspaceId, enrolled_by: user?.id ?? null,
        }));
        const { error } = await (supabase.from("campaign_enrollments") as any)
          .upsert(rows, { onConflict: "campaign_id,contact_id", ignoreDuplicates: true });
        if (error) throw error;
        toast.success(`Enrolled ${contactIds.length} contact(s) in campaign`);
      } else {
        const { data, error } = await supabase.rpc("linkedin_enroll_leads_v2", {
          _campaign_id: selectedId, _contact_ids: contactIds, _only_new: false,
        });
        if (error) throw error;
        const r = data as any;
        toast.success(`LinkedIn campaign: ${r?.added ?? 0} added, ${r?.skipped ?? 0} skipped`);
      }
      onSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Enrollment failed");
    } finally {
      setBusy(false);
    }
  }

  const list = target === "campaign" ? campaigns : liCampaigns;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Enroll in Campaign</DialogTitle>
          <DialogDescription className="text-xs">{contactIds.length} contact(s) selected.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Channel</Label>
            <RadioGroup value={target} onValueChange={(v: any) => { setTarget(v); setSelectedId(""); }} className="mt-1 grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 border rounded-md p-2">
                <RadioGroupItem value="campaign" id="ec-email" />
                <Label htmlFor="ec-email" className="text-sm cursor-pointer">Email campaign</Label>
              </div>
              <div className="flex items-center gap-2 border rounded-md p-2">
                <RadioGroupItem value="linkedin_campaign" id="ec-li" />
                <Label htmlFor="ec-li" className="text-sm cursor-pointer">LinkedIn campaign</Label>
              </div>
            </RadioGroup>
          </div>
          <div>
            <Label className="text-xs">Campaign</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="mt-1 h-9 text-sm">
                <SelectValue placeholder={list.length === 0 ? "No campaigns yet" : "Select a campaign"} />
              </SelectTrigger>
              <SelectContent>
                {list.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleEnroll} disabled={busy || !selectedId}>
            {busy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Enroll
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
