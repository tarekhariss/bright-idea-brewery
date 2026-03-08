import { Inbox, Globe, Mail, Plus, ArrowRight } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DeliverabilitySettings() {
  return (
    <PageShell
      icon={Inbox}
      title="Deliverability Suite"
      description="Set up your mailbox to scale outbound and power sequences, conversations, meetings, and more."
    >
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Mail className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold">Link your mailbox to get started</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Set up your mailbox to scale your outbound and do more with sequences, conversations, meetings, and other features.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <Card className="group cursor-pointer hover:border-primary/30 transition-all">
          <CardContent className="p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 mb-3">
              <Globe className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-semibold">Add Domain</h4>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Authenticate your sending domain with SPF, DKIM, and DMARC records.
            </p>
            <Button variant="outline" size="sm" className="mt-3 text-xs gap-1">
              <Plus className="h-3 w-3" /> Add Domain
            </Button>
          </CardContent>
        </Card>

        <Card className="group cursor-pointer hover:border-primary/30 transition-all">
          <CardContent className="p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 mb-3">
              <Inbox className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-semibold">Add Mailbox</h4>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Connect a mailbox via SMTP/IMAP to start sending and receiving emails.
            </p>
            <Button variant="outline" size="sm" className="mt-3 text-xs gap-1">
              <Plus className="h-3 w-3" /> Add Mailbox
            </Button>
          </CardContent>
        </Card>

        <Card className="group cursor-pointer hover:border-primary/30 transition-all">
          <CardContent className="p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500 mb-3">
              <Mail className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-semibold">Link Mailbox</h4>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Link an existing Google or Microsoft mailbox with OAuth for quick setup.
            </p>
            <Button variant="outline" size="sm" className="mt-3 text-xs gap-1">
              <ArrowRight className="h-3 w-3" /> Link Mailbox
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
