import { useState } from "react";
import {
  FileText, Plus, MoreHorizontal, Copy, Trash2, Edit, Loader2, Beaker,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useEmailTemplates, useCreateEmailTemplate, useUpdateEmailTemplate, useDeleteEmailTemplate } from "@/hooks/use-outbound-config";

export default function EmailTemplatesPage() {
  const { data: templates, isLoading } = useEmailTemplates();
  const createTemplate = useCreateEmailTemplate();
  const deleteTemplate = useDeleteEmailTemplate();
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await createTemplate.mutateAsync({ name: newName.trim(), subject: newSubject, body: newBody });
    setAddOpen(false);
    setNewName(""); setNewSubject(""); setNewBody("");
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Email Templates</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Create reusable templates with A/B variants for campaigns and sequences.</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : !templates?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <FileText className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-medium">No templates yet</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
              Create your first email template with subject lines and body content for outbound campaigns.
            </p>
            <Button size="sm" className="mt-5 text-xs gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Template</TableHead>
                <TableHead className="text-xs">Subject</TableHead>
                <TableHead className="text-xs">Variants</TableHead>
                <TableHead className="text-xs">Created</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="text-sm font-medium">{t.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{t.subject || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {t.email_variants?.length ? t.email_variants.map((v) => (
                        <Badge key={v.id} variant="secondary" className="text-[10px]">{v.variant_name}</Badge>
                      )) : <Badge variant="secondary" className="text-[10px]">No variants</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(t.created_at), "MMM d, yyyy")}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Edit className="h-3.5 w-3.5 mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem><Copy className="h-3.5 w-3.5 mr-2" /> Duplicate</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => deleteTemplate.mutate(t.id)}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">New Email Template</DialogTitle>
            <DialogDescription className="text-sm">Create a reusable email template for campaigns and sequences.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Template Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Cold outreach v1" className="mt-1 h-9 text-sm" autoFocus />
            </div>
            <div>
              <Label className="text-xs">Subject Line</Label>
              <Input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Quick question about {{company}}" className="mt-1 h-9 text-sm" />
              <p className="text-[10px] text-muted-foreground mt-1">Use {"{{variable}}"} — e.g. {"{{first_name}}"}, {"{{company_summary}}"}, {"{{pain_point}}"}, {"{{recent_signal}}"}</p>
            </div>
            <div>
              <Label className="text-xs">Email Body</Label>
              <Textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} placeholder="Hi {{first_name}},..." className="mt-1 text-sm min-h-[120px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={!newName.trim() || createTemplate.isPending}>
              {createTemplate.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
