/**
 * ConfigRequiredModal — opens when the user clicks an action that cannot run
 * until a provider is configured. Lists every missing dependency with a deep
 * link to the right settings page.
 */
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useConfigStatus, type CapabilityKey } from "@/hooks/use-config-status";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the user tried to do, e.g. "Launch campaign". */
  action: string;
  capabilities: CapabilityKey[];
}

export function ConfigRequiredModal({ open, onOpenChange, action, capabilities }: Props) {
  const status = useConfigStatus();
  const missing = capabilities
    .map((k) => ({ key: k, cap: status[k] }))
    .filter((x) => !x.cap.ready);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Configuration required
          </DialogTitle>
          <DialogDescription>
            "{action}" can't run yet. Set up the items below first — your data and
            settings are saved, so you can resume after configuring.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 py-2">
          {missing.map(({ key, cap }) => (
            <li
              key={key}
              className="flex items-start justify-between gap-3 rounded-md border p-3"
            >
              <div className="text-sm">
                <div className="font-medium capitalize">{key.replace("oauth", "OAuth ")}</div>
                <div className="text-muted-foreground">{cap.reason}</div>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to={cap.fixHref} onClick={() => onOpenChange(false)}>
                  {cap.fixLabel}
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </li>
          ))}
          {missing.length === 0 && (
            <li className="text-sm text-muted-foreground">
              Everything is configured. Close this dialog and try again.
            </li>
          )}
        </ul>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
