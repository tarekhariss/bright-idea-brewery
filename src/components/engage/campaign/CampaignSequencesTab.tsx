import { useState } from "react";
import {
  Plus, Trash2, GripVertical, Mail, Linkedin, CheckSquare, Clock, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  useCampaignSteps, useAddCampaignStep, useDeleteCampaignStep, useEmailTemplatesList,
} from "@/hooks/use-campaign-workflow";
import { useLinkedinMessageTemplates } from "@/hooks/use-linkedin";

const stepTypeConfig: Record<string, { icon: any; label: string; color: string }> = {
  email: { icon: Mail, label: "Email", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  linkedin_connect: { icon: Linkedin, label: "LinkedIn Connect", color: "bg-sky-500/10 text-sky-600 border-sky-500/20" },
  linkedin_message: { icon: Linkedin, label: "LinkedIn Message", color: "bg-sky-500/10 text-sky-600 border-sky-500/20" },
  task: { icon: CheckSquare, label: "Manual Task", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  delay: { icon: Clock, label: "Delay", color: "bg-muted text-muted-foreground" },
};

export function CampaignSequencesTab({ campaignId }: { campaignId: string }) {
  const { data: steps, isLoading } = useCampaignSteps(campaignId);
  const { data: templates } = useEmailTemplatesList();
  const { data: linkedinTemplates } = useLinkedinMessageTemplates();
  const addStep = useAddCampaignStep();
  const deleteStep = useDeleteCampaignStep();

  const [open, setOpen] = useState(false);
  const [stepType, setStepType] = useState("email");
  const [delayDays, setDelayDays] = useState(0);
  const [delayHours, setDelayHours] = useState(0);
  const [templateId, setTemplateId] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [linkedinTemplateId, setLinkedinTemplateId] = useState("");

  const reset = () => {
    setStepType("email"); setDelayDays(0); setDelayHours(0);
    setTemplateId(""); setTaskDesc(""); setLinkedinTemplateId("");
  };

  const handleAdd = async () => {
    const nextOrder = (steps?.length || 0) + 1;
    await addStep.mutateAsync({
      campaign_id: campaignId,
      step_order: nextOrder,
      step_type: stepType,
      delay_days: delayDays,
      delay_hours: delayHours,
      email_template_id: templateId || undefined,
      task_description: taskDesc || undefined,
      ...(linkedinTemplateId ? { linkedin_message_template_id: linkedinTemplateId } : {}),
    } as any);
    setOpen(false);
    reset();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Sequence Builder</p>
          <p className="text-xs text-muted-foreground">
            {steps?.length || 0} step{(steps?.length || 0) === 1 ? "" : "s"} · runs for every lead enrolled in this campaign
          </p>
        </div>
        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Step
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : !steps?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Clock className="mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">No sequence steps yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add your first step to define how leads are reached.
            </p>
            <Button size="sm" className="mt-4 h-8 gap-1.5 text-xs" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Step
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {steps.map((step: any, idx: number) => {
            const cfg = stepTypeConfig[step.step_type] || stepTypeConfig.task;
            const Icon = cfg.icon;
            const hasDelay = step.delay_days > 0 || step.delay_hours > 0;
            return (
              <Card key={step.id} className="group">
                <CardContent className="flex items-center gap-3 px-4 py-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <GripVertical className="h-3.5 w-3.5 cursor-grab opacity-0 group-hover:opacity-50" />
                    <span className="w-5 text-center font-mono text-xs">{idx + 1}</span>
                  </div>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${cfg.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{cfg.label}</p>
                    {step.step_type === "email" && step.email_templates && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        Template: {step.email_templates.name}
                        {step.email_templates.subject ? ` · ${step.email_templates.subject}` : ""}
                      </p>
                    )}
                    {(step.step_type === "task" || step.step_type === "linkedin_connect" || step.step_type === "linkedin_message") && step.task_description && (
                      <p className="truncate text-[11px] text-muted-foreground">{step.task_description}</p>
                    )}
                    {hasDelay && (
                      <p className="text-[10px] text-muted-foreground/70">
                        Wait {step.delay_days > 0 ? `${step.delay_days}d` : ""}
                        {step.delay_hours > 0 ? ` ${step.delay_hours}h` : ""} before this step
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100"
                    onClick={() => deleteStep.mutate({ id: step.id, campaignId })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Step */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Add Sequence Step</DialogTitle>
            <DialogDescription className="text-sm">Add a new action that runs for every lead in this campaign.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Step Type</Label>
              <Select value={stepType} onValueChange={setStepType}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="linkedin_connect">LinkedIn Connect</SelectItem>
                  <SelectItem value="linkedin_message">LinkedIn Message</SelectItem>
                  <SelectItem value="task">Manual Task</SelectItem>
                  <SelectItem value="delay">Delay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Delay (days)</Label>
                <Input type="number" value={delayDays} onChange={(e) => setDelayDays(parseInt(e.target.value) || 0)} className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Delay (hours)</Label>
                <Input type="number" value={delayHours} onChange={(e) => setDelayHours(parseInt(e.target.value) || 0)} className="mt-1 h-9 text-sm" />
              </div>
            </div>
            {stepType === "email" && (
              <div>
                <Label className="text-xs">Email Template</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="Select template..." /></SelectTrigger>
                  <SelectContent>
                    {templates?.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {stepType === "linkedin_message" && (
              <div>
                <Label className="text-xs">LinkedIn Message Template</Label>
                <Select value={linkedinTemplateId} onValueChange={setLinkedinTemplateId}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="Select template..." /></SelectTrigger>
                  <SelectContent>
                    {linkedinTemplates?.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(stepType === "task" || stepType === "linkedin_connect" || stepType === "linkedin_message") && (
              <div>
                <Label className="text-xs">Task Description</Label>
                <Textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} className="mt-1 text-sm" rows={2} placeholder="Describe the action..." />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={addStep.isPending}>
              {addStep.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Add Step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
