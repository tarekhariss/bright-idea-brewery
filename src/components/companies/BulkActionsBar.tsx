import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronDown, Globe, Building2, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  selectedIds: string[];
  onDone: () => void;
}

type ActionType = "industry" | "country" | null;

export function CompanyBulkActionsBar({ selectedIds, onDone }: Props) {
  const { user } = useAuth();
  const [action, setAction] = useState<ActionType>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const count = selectedIds.length;
  if (count === 0) return null;

  async function logActivity(companyIds: string[], type: string, details: Record<string, any>) {
    const logs = companyIds.map((company_id) => ({
      company_id,
      activity_type: type,
      details,
      performed_by: user?.id ?? null,
    }));
    await supabase.from("company_activity_log").insert(logs);
  }

  async function applyUpdate(field: string, val: string, actType: string) {
    setBusy(true);
    const { error } = await supabase.from("companies").update({ [field]: val }).in("id", selectedIds);
    if (error) toast.error("Update failed");
    else {
      await logActivity(selectedIds, actType, { field, value: val });
      toast.success(`Updated ${count} companies`);
      onDone();
    }
    setBusy(false);
    setAction(null);
    setValue("");
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
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => setAction("industry")}>
              <Building2 className="h-3.5 w-3.5 mr-2" /> Update Industry
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAction("country")}>
              <Globe className="h-3.5 w-3.5 mr-2" /> Update Country
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <Download className="h-3.5 w-3.5 mr-2" /> Export (coming soon)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={action === "industry"} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Industry</DialogTitle>
            <DialogDescription>Apply to {count} selected companies</DialogDescription>
          </DialogHeader>
          <Input placeholder="Enter industry" value={value} onChange={(e) => setValue(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
            <Button disabled={!value.trim() || busy} onClick={() => applyUpdate("industry", value.trim(), "bulk_industry_update")}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={action === "country"} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Country</DialogTitle>
            <DialogDescription>Apply to {count} selected companies</DialogDescription>
          </DialogHeader>
          <Input placeholder="Enter country" value={value} onChange={(e) => setValue(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
            <Button disabled={!value.trim() || busy} onClick={() => applyUpdate("country", value.trim(), "bulk_country_update")}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
