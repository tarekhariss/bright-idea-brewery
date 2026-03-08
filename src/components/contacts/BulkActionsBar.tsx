import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ListPlus, ChevronDown, Shield, ShieldOff, Tag, UserPlus, RefreshCw, FileText } from "lucide-react";
import { toast } from "sonner";
import type { LifecycleStatus, OutreachStatus } from "@/integrations/supabase/db-types";

interface BulkActionsBarProps {
  selectedIds: string[];
  onDone: () => void;
  onOpenAddToList: () => void;
}

type ActionType = "lifecycle" | "outreach" | "source" | "dnc_on" | "dnc_off" | null;

const LIFECYCLE_OPTIONS: { value: LifecycleStatus; label: string }[] = [
  { value: "new", label: "New" }, { value: "researching", label: "Researching" },
  { value: "qualified", label: "Qualified" }, { value: "nurturing", label: "Nurturing" },
  { value: "engaged", label: "Engaged" }, { value: "converted", label: "Converted" },
  { value: "churned", label: "Churned" }, { value: "archived", label: "Archived" },
];

const OUTREACH_OPTIONS: { value: OutreachStatus; label: string }[] = [
  { value: "not_contacted", label: "Not Contacted" }, { value: "queued", label: "Queued" },
  { value: "contacted", label: "Contacted" }, { value: "replied", label: "Replied" },
  { value: "bounced", label: "Bounced" }, { value: "opted_out", label: "Opted Out" },
  { value: "unresponsive", label: "Unresponsive" },
];

export function BulkActionsBar({ selectedIds, onDone, onOpenAddToList }: BulkActionsBarProps) {
  const { user } = useAuth();
  const [action, setAction] = useState<ActionType>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const count = selectedIds.length;
  if (count === 0) return null;

  async function logActivity(contactIds: string[], type: string, details: Record<string, any>) {
    const logs = contactIds.map((contact_id) => ({
      contact_id,
      activity_type: type,
      details,
      performed_by: user?.id ?? null,
    }));
    await supabase.from("contact_activity_log").insert(logs);
  }

  async function applyBulkUpdate(field: string, val: any, actType: string) {
    setBusy(true);
    const { error } = await supabase.from("contacts").update({ [field]: val }).in("id", selectedIds);
    if (error) { toast.error("Update failed"); }
    else {
      await logActivity(selectedIds, actType, { field, value: val });
      toast.success(`Updated ${count} contacts`);
      onDone();
    }
    setBusy(false);
    setAction(null);
    setValue("");
  }

  async function handleDnc(on: boolean) {
    setBusy(true);
    const { error } = await supabase.from("contacts").update({ do_not_contact: on }).in("id", selectedIds);
    if (error) toast.error("Update failed");
    else {
      await logActivity(selectedIds, on ? "marked_dnc" : "cleared_dnc", {});
      toast.success(`${on ? "Marked" : "Cleared"} DNC for ${count} contacts`);
      onDone();
    }
    setBusy(false);
    setAction(null);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{count} selected</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              Bulk Actions <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem onClick={onOpenAddToList}>
              <ListPlus className="h-3.5 w-3.5 mr-2" /> Add to List
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setAction("lifecycle")}>
              <RefreshCw className="h-3.5 w-3.5 mr-2" /> Update Lifecycle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAction("outreach")}>
              <RefreshCw className="h-3.5 w-3.5 mr-2" /> Update Outreach
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAction("source")}>
              <FileText className="h-3.5 w-3.5 mr-2" /> Update Source
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setAction("dnc_on")}>
              <Shield className="h-3.5 w-3.5 mr-2" /> Mark Do Not Contact
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAction("dnc_off")}>
              <ShieldOff className="h-3.5 w-3.5 mr-2" /> Clear Do Not Contact
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Lifecycle dialog */}
      <Dialog open={action === "lifecycle"} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Lifecycle Status</DialogTitle>
            <DialogDescription>Apply to {count} selected contacts</DialogDescription>
          </DialogHeader>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {LIFECYCLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
            <Button disabled={!value || busy} onClick={() => applyBulkUpdate("lifecycle_status", value, "bulk_lifecycle_update")}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Outreach dialog */}
      <Dialog open={action === "outreach"} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Outreach Status</DialogTitle>
            <DialogDescription>Apply to {count} selected contacts</DialogDescription>
          </DialogHeader>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {OUTREACH_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
            <Button disabled={!value || busy} onClick={() => applyBulkUpdate("outreach_status", value, "bulk_outreach_update")}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Source dialog */}
      <Dialog open={action === "source"} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Source</DialogTitle>
            <DialogDescription>Apply to {count} selected contacts</DialogDescription>
          </DialogHeader>
          <Input placeholder="Enter source value" value={value} onChange={(e) => setValue(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
            <Button disabled={!value.trim() || busy} onClick={() => applyBulkUpdate("source", value.trim(), "bulk_source_update")}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DNC confirmations */}
      <Dialog open={action === "dnc_on"} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark as Do Not Contact</DialogTitle>
            <DialogDescription>This will flag {count} contacts as Do Not Contact. Are you sure?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={() => handleDnc(true)}>Mark DNC</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={action === "dnc_off"} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Clear Do Not Contact</DialogTitle>
            <DialogDescription>Remove DNC flag from {count} contacts?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
            <Button disabled={busy} onClick={() => handleDnc(false)}>Clear DNC</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
