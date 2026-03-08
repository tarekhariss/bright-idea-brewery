import { useState } from "react";
import {
  Route, Plus, Trash2, Loader2, ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useEspRoutingRules, useCreateEspRule, useDeleteEspRule } from "@/hooks/use-outbound-config";

const RECIPIENT_PROVIDERS = ["gmail", "outlook", "yahoo", "hotmail", "other"];
const MAILBOX_PROVIDERS = ["gmail", "outlook", "smtp", "ses", "sendgrid", "mailgun"];

export default function ESPRoutingPage() {
  const { data: rules, isLoading } = useEspRoutingRules();
  const createRule = useCreateEspRule();
  const deleteRule = useDeleteEspRule();
  const [addOpen, setAddOpen] = useState(false);
  const [recipient, setRecipient] = useState("gmail");
  const [preferred, setPreferred] = useState("gmail");

  const handleAdd = async () => {
    await createRule.mutateAsync({ recipient_provider: recipient, preferred_mailbox_provider: preferred });
    setAddOpen(false);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
            <Route className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">ESP Routing</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Route outbound emails to the best-matching mailbox provider for maximum deliverability.
            </p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Rule
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : !rules?.length ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Route className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No routing rules. Emails will use round-robin mailbox selection by default.</p>
            <Button size="sm" className="mt-4 text-xs gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-xs capitalize">{r.recipient_provider}</Badge>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <Badge className="text-xs capitalize bg-primary/10 text-primary border-primary/20">{r.preferred_mailbox_provider}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] ${r.is_active ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-muted text-muted-foreground"}`}>
                    {r.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteRule.mutate(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>How it works:</strong> When sending to a Gmail recipient, the system will prefer a Gmail mailbox.
            This improves inbox placement because emails from the same provider ecosystem are less likely to be flagged.
            Rules are evaluated by priority (lower = higher priority).
          </p>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Add Routing Rule</DialogTitle>
            <DialogDescription className="text-sm">Map recipient email provider to preferred sending provider.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Recipient Provider</Label>
              <Select value={recipient} onValueChange={setRecipient}>
                <SelectTrigger className="mt-1 h-9 text-sm capitalize"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECIPIENT_PROVIDERS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Preferred Mailbox Provider</Label>
              <Select value={preferred} onValueChange={setPreferred}>
                <SelectTrigger className="mt-1 h-9 text-sm capitalize"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MAILBOX_PROVIDERS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={createRule.isPending}>
              {createRule.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Add Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
