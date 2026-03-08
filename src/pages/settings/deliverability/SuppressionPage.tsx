import { useState } from "react";
import {
  ShieldBan, Plus, Trash2, User, Globe, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { format } from "date-fns";
import {
  useContactSuppression, useDomainSuppression,
  useCreateDomainSuppression, useDeleteContactSuppression, useDeleteDomainSuppression,
} from "@/hooks/use-outbound-config";

export default function SuppressionPage() {
  const { data: contacts, isLoading: cLoading } = useContactSuppression();
  const { data: domains, isLoading: dLoading } = useDomainSuppression();
  const createDomainSup = useCreateDomainSuppression();
  const deleteContact = useDeleteContactSuppression();
  const deleteDomain = useDeleteDomainSuppression();

  const [addDomainOpen, setAddDomainOpen] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [newReason, setNewReason] = useState("manual");

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return;
    await createDomainSup.mutateAsync({ domain: newDomain.trim().toLowerCase(), reason: newReason });
    setAddDomainOpen(false);
    setNewDomain("");
    setNewReason("manual");
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <ShieldBan className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suppression Lists</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage contacts and domains excluded from all outbound sending.
          </p>
        </div>
      </div>

      <Tabs defaultValue="domains" className="space-y-4">
        <TabsList className="h-8">
          <TabsTrigger value="domains" className="text-xs h-7 gap-1"><Globe className="h-3 w-3" /> Domains ({domains?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="contacts" className="text-xs h-7 gap-1"><User className="h-3 w-3" /> Contacts ({contacts?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="domains" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" className="text-xs gap-1.5" onClick={() => setAddDomainOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Domain
            </Button>
          </div>
          {dLoading ? (
            <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : !domains?.length ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Globe className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No suppressed domains. Add domains you want to exclude from sending.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1">
              {domains.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{d.domain}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[10px]">{d.reason}</Badge>
                      <span className="text-[10px] text-muted-foreground">{format(new Date(d.created_at), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteDomain.mutate(d.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="contacts" className="space-y-3">
          {cLoading ? (
            <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : !contacts?.length ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <User className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No suppressed contacts. Contacts will appear here when suppressed from campaigns.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1">
              {contacts.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{c.contacts?.first_name} {c.contacts?.last_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{c.contacts?.email}</span>
                      <Badge variant="secondary" className="text-[10px]">{c.reason}</Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteContact.mutate(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={addDomainOpen} onOpenChange={setAddDomainOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Suppress Domain</DialogTitle>
            <DialogDescription className="text-sm">Emails to this domain will be blocked from all campaigns.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Domain</Label>
              <Input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="competitor.com" className="mt-1 h-9 text-sm" autoFocus />
            </div>
            <div>
              <Label className="text-xs">Reason</Label>
              <Input value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="competitor, bounce, etc." className="mt-1 h-9 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddDomainOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddDomain} disabled={!newDomain.trim() || createDomainSup.isPending}>
              {createDomainSup.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Suppress Domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
