import { useState } from "react";
import { FileText, Plus, Trash2, Loader2, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useLinkedinMessageTemplates, useCreateLinkedinMessageTemplate, useUpdateLinkedinMessageTemplate, useDeleteLinkedinMessageTemplate } from "@/hooks/use-linkedin";

export default function LinkedinTemplatesPage() {
  const { data: templates, isLoading } = useLinkedinMessageTemplates();
  const create = useCreateLinkedinMessageTemplate();
  const update = useUpdateLinkedinMessageTemplate();
  const remove = useDeleteLinkedinMessageTemplate();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    await create.mutateAsync({ name: name.trim(), message_body: body });
    setOpen(false); setName(""); setBody("");
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600"><FileText className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">LinkedIn Templates</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Reusable message templates for connection requests and follow-ups.</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" />New Template</Button>
      </div>

      {isLoading ? <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div> :
        !templates?.length ? (
          <Card className="border-dashed"><CardContent className="py-16 text-center text-sm text-muted-foreground">No templates yet.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {templates.map((t: any) => (
              <Card key={t.id}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Input defaultValue={t.name} onBlur={(e) => update.mutate({ id: t.id, name: e.target.value })} className="h-8 text-sm font-medium border-0 px-0 focus-visible:ring-0" />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove.mutate(t.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                  <Textarea defaultValue={t.message_body || ""} onBlur={(e) => update.mutate({ id: t.id, message_body: e.target.value })} className="text-sm min-h-[100px]" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-base">New Template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-9 text-sm" autoFocus /></div>
            <div><Label className="text-xs">Message Body</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} className="mt-1 text-sm min-h-[120px]" placeholder="Hi {first_name}, I noticed..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={!name.trim() || create.isPending}>
              {create.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
