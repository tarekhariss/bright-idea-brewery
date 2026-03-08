import { useState } from "react";
import {
  Mail, Plus, Send, Loader2, MoreHorizontal, ArrowUpRight, Clock,
  Inbox, Eye,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useEmails, useCreateEmail, useQueueEmail } from "@/hooks/use-engage";
import { useMailboxes } from "@/hooks/use-deliverability";
import { useSendEmail, usePreviewPayload } from "@/hooks/use-email-admin";

const statusBadge = (s: string) => {
  const map: Record<string, { cls: string; label: string }> = {
    draft: { cls: "bg-muted text-muted-foreground", label: "Draft" },
    queued: { cls: "bg-blue-500/10 text-blue-600 border-blue-500/20", label: "Queued" },
    processing: { cls: "bg-amber-500/10 text-amber-600 border-amber-500/20", label: "Processing" },
    sent_mock: { cls: "bg-violet-500/10 text-violet-600 border-violet-500/20", label: "Sent (Mock)" },
    sent: { cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", label: "Sent" },
    failed: { cls: "bg-destructive/10 text-destructive border-destructive/20", label: "Failed" },
    bounced: { cls: "bg-destructive/10 text-destructive border-destructive/20", label: "Bounced" },
  };
  const m = map[s] || map.draft;
  return <Badge className={`${m.cls} text-[10px]`}>{m.label}</Badge>;
};

export default function EmailsPage() {
  const { data: emails, isLoading } = useEmails();
  const { data: mailboxes } = useMailboxes();
  const createEmail = useCreateEmail();
  const queueEmail = useQueueEmail();
  const sendEmail = useSendEmail();
  const previewPayload = usePreviewPayload();

  const [composeOpen, setComposeOpen] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedMailboxId, setSelectedMailboxId] = useState("");
  const [previewData, setPreviewData] = useState<any>(null);

  const activeMailboxes = mailboxes?.filter((m) => m.connection_status === "active") || [];

  const handleCreate = async () => {
    if (!to.trim() || !subject.trim()) return;
    await createEmail.mutateAsync({
      to_address: to.trim(),
      subject: subject.trim(),
      body_html: body,
    });
    setComposeOpen(false);
    setTo(""); setSubject(""); setBody("");
  };

  const handleQueueAndSend = async (emailId: string) => {
    if (!selectedMailboxId && !activeMailboxes.length) {
      return;
    }
    const mbId = selectedMailboxId || activeMailboxes[0]?.id;
    if (!mbId) return;

    await queueEmail.mutateAsync(emailId);
    sendEmail.mutate({ emailId, mailboxId: mbId });
  };

  const handlePreview = async (emailId: string) => {
    const mbId = selectedMailboxId || activeMailboxes[0]?.id;
    if (!mbId) return;
    const data = await previewPayload.mutateAsync({ emailId, mailboxId: mbId });
    setPreviewData(data);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Emails</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track sent emails, opens, clicks, and replies across all your outreach.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeMailboxes.length > 0 && (
            <Select value={selectedMailboxId} onValueChange={setSelectedMailboxId}>
              <SelectTrigger className="h-8 text-xs w-48">
                <Inbox className="h-3 w-3 mr-1.5" />
                <SelectValue placeholder="Select mailbox" />
              </SelectTrigger>
              <SelectContent>
                {activeMailboxes.map((mb) => (
                  <SelectItem key={mb.id} value={mb.id} className="text-xs">{mb.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setComposeOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Compose
          </Button>
        </div>
      </div>

      {!activeMailboxes.length && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-800">
          <strong>No active mailbox.</strong> Connect a mailbox in Deliverability → Mailboxes to enable real sending.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : !emails?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <Mail className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-medium">No emails yet</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
              Compose and send emails to your prospects. All activity including opens, clicks, and replies will be tracked here.
            </p>
            <Button size="sm" className="mt-5 gap-1.5 text-xs" onClick={() => setComposeOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Compose Email
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">To</TableHead>
                <TableHead className="text-xs">Subject</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Contact</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email: any) => (
                <TableRow key={email.id}>
                  <TableCell className="text-sm">{email.to_address}</TableCell>
                  <TableCell className="text-sm font-medium max-w-[200px] truncate">{email.subject}</TableCell>
                  <TableCell>{statusBadge(email.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {email.contacts ? `${email.contacts.first_name || ""} ${email.contacts.last_name || ""}`.trim() : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(email.created_at), "MMM d, HH:mm")}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {email.status === "draft" && activeMailboxes.length > 0 && (
                          <DropdownMenuItem onClick={() => handleQueueAndSend(email.id)}>
                            <Send className="h-3.5 w-3.5 mr-2" /> Queue & Send
                          </DropdownMenuItem>
                        )}
                        {(email.status === "draft" || email.status === "queued") && activeMailboxes.length > 0 && (
                          <DropdownMenuItem onClick={() => handlePreview(email.id)}>
                            <Eye className="h-3.5 w-3.5 mr-2" /> Preview Payload
                          </DropdownMenuItem>
                        )}
                        {email.status === "queued" && activeMailboxes.length > 0 && (
                          <DropdownMenuItem onClick={() => sendEmail.mutate({
                            emailId: email.id,
                            mailboxId: selectedMailboxId || activeMailboxes[0]?.id,
                          })}>
                            <ArrowUpRight className="h-3.5 w-3.5 mr-2" /> Send Now
                          </DropdownMenuItem>
                        )}
                        {email.error_message && (
                          <DropdownMenuItem className="text-destructive text-xs" disabled>
                            Error: {email.error_message.slice(0, 50)}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Compose Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Compose Email</DialogTitle>
            <DialogDescription className="text-sm">Create a new email. It will be saved as a draft until you queue it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">To</Label>
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@example.com" className="mt-1 h-9 text-sm" autoFocus />
            </div>
            <div>
              <Label className="text-xs">Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject line" className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Body</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your email..." className="mt-1 text-sm" rows={6} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setComposeOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={!to.trim() || !subject.trim() || createEmail.isPending}>
              {createEmail.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Payload Dialog */}
      <Dialog open={!!previewData} onOpenChange={() => setPreviewData(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Send Payload Preview</DialogTitle>
            <DialogDescription className="text-sm">This is what would be sent via SMTP (dry run).</DialogDescription>
          </DialogHeader>
          {previewData && (
            <pre className="text-xs bg-muted rounded-lg p-4 overflow-auto max-h-80 whitespace-pre-wrap">
              {JSON.stringify(previewData, null, 2)}
            </pre>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPreviewData(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
