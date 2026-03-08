import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Trash2, GripVertical, Mail, Linkedin, CheckSquare, Clock,
  Users, Play, Pause, Loader2, MoreHorizontal, UserPlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useCampaign, useUpdateCampaign } from "@/hooks/use-campaigns";
import {
  useCampaignSteps, useAddCampaignStep, useUpdateCampaignStep, useDeleteCampaignStep,
  useCampaignEnrollments, useEnrollContacts, useUpdateEnrollment, useEmailTemplatesList,
} from "@/hooks/use-campaign-workflow";
import {
  useLinkedinMessageTemplates, useCampaignLinkedinAccounts,
  useLinkLinkedinAccount, useUnlinkLinkedinAccount, useLinkedinAccounts,
} from "@/hooks/use-linkedin";
import { toast } from "sonner";
import { CampaignAnalyticsTab } from "@/components/analytics/CampaignAnalyticsTab";

const stepTypeConfig: Record<string, { icon: any; label: string; color: string }> = {
  email: { icon: Mail, label: "Email", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  linkedin_connect: { icon: Linkedin, label: "LinkedIn Connect", color: "bg-sky-500/10 text-sky-600 border-sky-500/20" },
  linkedin_message: { icon: Linkedin, label: "LinkedIn Message", color: "bg-sky-500/10 text-sky-600 border-sky-500/20" },
  task: { icon: CheckSquare, label: "Manual Task", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  delay: { icon: Clock, label: "Delay", color: "bg-muted text-muted-foreground" },
};

const enrollmentStatusBadge = (s: string) => {
  const map: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    completed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    stopped: "bg-destructive/10 text-destructive border-destructive/20",
  };
  return <Badge className={`${map[s] || map.pending} text-[10px] capitalize`}>{s}</Badge>;
};

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: campaign, isLoading: loadingCampaign } = useCampaign(id || null);
  const { data: steps, isLoading: loadingSteps } = useCampaignSteps(id || null);
  const { data: enrollments, isLoading: loadingEnrollments } = useCampaignEnrollments(id || null);
  const { data: templates } = useEmailTemplatesList();
  const { data: linkedinTemplates } = useLinkedinMessageTemplates();
  const { data: linkedinAccounts } = useLinkedinAccounts();
  const { data: campaignLinkedinAccounts } = useCampaignLinkedinAccounts(id || null);
  const linkLinkedin = useLinkLinkedinAccount();
  const unlinkLinkedin = useUnlinkLinkedinAccount();
  const updateCampaign = useUpdateCampaign();
  const addStep = useAddCampaignStep();
  const updateStep = useUpdateCampaignStep();
  const deleteStep = useDeleteCampaignStep();
  const enrollContacts = useEnrollContacts();
  const updateEnrollment = useUpdateEnrollment();

  const [addStepOpen, setAddStepOpen] = useState(false);
  const [newStepType, setNewStepType] = useState("email");
  const [newDelayDays, setNewDelayDays] = useState(0);
  const [newDelayHours, setNewDelayHours] = useState(0);
  const [newTemplateId, setNewTemplateId] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newLinkedinTemplateId, setNewLinkedinTemplateId] = useState("");

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollContactIds, setEnrollContactIds] = useState("");

  if (loadingCampaign) return <div className="p-6"><Skeleton className="h-8 w-64 mb-4" /><Skeleton className="h-96 w-full" /></div>;
  if (!campaign) return <div className="p-6 text-muted-foreground">Campaign not found.</div>;

  const handleAddStep = async () => {
    const nextOrder = (steps?.length || 0) + 1;
    await addStep.mutateAsync({
      campaign_id: id!,
      step_order: nextOrder,
      step_type: newStepType,
      delay_days: newDelayDays,
      delay_hours: newDelayHours,
      email_template_id: newTemplateId || undefined,
      task_description: newTaskDesc || undefined,
      ...(newLinkedinTemplateId ? { linkedin_message_template_id: newLinkedinTemplateId } : {}),
    });
    setAddStepOpen(false);
    setNewStepType("email"); setNewDelayDays(0); setNewDelayHours(0); setNewTemplateId(""); setNewTaskDesc(""); setNewLinkedinTemplateId("");
  };

  const handleEnroll = async () => {
    const ids = enrollContactIds.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
    if (!ids.length) return;
    await enrollContacts.mutateAsync({ campaignId: id!, contactIds: ids });
    setEnrollOpen(false);
    setEnrollContactIds("");
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/engage/campaigns")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {campaign.status} · {enrollments?.length || 0} contacts enrolled
          </p>
        </div>
        <div className="flex gap-2">
          {campaign.status === "draft" && (
            <Button size="sm" className="gap-1.5 text-xs" onClick={() => updateCampaign.mutate({ id: id!, status: "active" as any })}>
              <Play className="h-3.5 w-3.5" /> Activate
            </Button>
          )}
          {campaign.status === "active" && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => updateCampaign.mutate({ id: id!, status: "paused" as any })}>
              <Pause className="h-3.5 w-3.5" /> Pause
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="steps" className="space-y-4">
        <TabsList>
          <TabsTrigger value="steps" className="text-xs">Workflow Steps</TabsTrigger>
          <TabsTrigger value="enrollments" className="text-xs">Contacts ({enrollments?.length || 0})</TabsTrigger>
          <TabsTrigger value="linkedin" className="text-xs">LinkedIn Accounts</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs">Analytics</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
        </TabsList>

        {/* ── Steps Tab ── */}
        <TabsContent value="steps" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{steps?.length || 0} steps in workflow</p>
            <Button size="sm" className="gap-1.5 text-xs" onClick={() => setAddStepOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Step
            </Button>
          </div>

          {loadingSteps ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : !steps?.length ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center py-16 text-center">
                <Clock className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium">No steps yet</p>
                <p className="text-xs text-muted-foreground mt-1">Add your first campaign step to build the outreach workflow.</p>
                <Button size="sm" className="mt-4 text-xs gap-1.5" onClick={() => setAddStepOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add Step
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {steps.map((step: any, idx: number) => {
                const cfg = stepTypeConfig[step.step_type] || stepTypeConfig.task;
                const Icon = cfg.icon;
                return (
                  <Card key={step.id} className="group">
                    <CardContent className="flex items-center gap-4 py-4 px-5">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <GripVertical className="h-4 w-4 opacity-0 group-hover:opacity-50 cursor-grab" />
                        <span className="text-xs font-mono w-6 text-center">{idx + 1}</span>
                      </div>
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${cfg.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{cfg.label}</p>
                        {step.step_type === "email" && step.email_templates && (
                          <p className="text-xs text-muted-foreground truncate">Template: {step.email_templates.name}</p>
                        )}
                        {(step.step_type === "task" || step.step_type === "linkedin_connect" || step.step_type === "linkedin_message") && step.task_description && (
                          <p className="text-xs text-muted-foreground truncate">{step.task_description}</p>
                        )}
                        {(step.delay_days > 0 || step.delay_hours > 0) && (
                          <p className="text-[10px] text-muted-foreground/70">
                            Wait {step.delay_days > 0 ? `${step.delay_days}d` : ""}{step.delay_hours > 0 ? ` ${step.delay_hours}h` : ""} before this step
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                        onClick={() => deleteStep.mutate({ id: step.id, campaignId: id! })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Enrollments Tab ── */}
        <TabsContent value="enrollments" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{enrollments?.length || 0} contacts</p>
            <Button size="sm" className="gap-1.5 text-xs" onClick={() => setEnrollOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" /> Enroll Contacts
            </Button>
          </div>

          {loadingEnrollments ? (
            <Skeleton className="h-48 w-full" />
          ) : !enrollments?.length ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center py-16 text-center">
                <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium">No contacts enrolled</p>
                <p className="text-xs text-muted-foreground mt-1">Add contacts to start the campaign workflow.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Contact</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Current Step</TableHead>
                    <TableHead className="text-xs">Enrolled</TableHead>
                    <TableHead className="text-xs w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollments.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm font-medium">
                        {e.contacts ? `${e.contacts.first_name || ""} ${e.contacts.last_name || ""}`.trim() || "—" : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.contacts?.email || "—"}</TableCell>
                      <TableCell>{enrollmentStatusBadge(e.status)}</TableCell>
                      <TableCell className="text-xs">
                        {e.campaign_steps ? `Step ${e.campaign_steps.step_order} (${e.campaign_steps.step_type})` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(e.created_at), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {e.status === "pending" && (
                              <DropdownMenuItem onClick={() => updateEnrollment.mutate({ id: e.id, campaignId: id!, status: "active" })}>
                                <Play className="h-3.5 w-3.5 mr-2" /> Activate
                              </DropdownMenuItem>
                            )}
                            {e.status === "active" && (
                              <DropdownMenuItem onClick={() => updateEnrollment.mutate({ id: e.id, campaignId: id!, status: "stopped" })}>
                                <Pause className="h-3.5 w-3.5 mr-2" /> Stop
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
        </TabsContent>

        {/* ── LinkedIn Accounts Tab ── */}
        <TabsContent value="linkedin" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{campaignLinkedinAccounts?.length || 0} LinkedIn accounts linked</p>
          </div>
          {campaignLinkedinAccounts?.length ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Profile</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignLinkedinAccounts.map((cla: any) => (
                    <TableRow key={cla.linkedin_account_id}>
                      <TableCell className="text-sm font-medium">{cla.linkedin_accounts?.profile_name || "—"}</TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${cla.linkedin_accounts?.connection_status === "connected" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-muted text-muted-foreground"}`}>
                          {cla.linkedin_accounts?.connection_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => unlinkLinkedin.mutate({ campaignId: id!, linkedinAccountId: cla.linkedin_account_id })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center py-12 text-center">
                <Linkedin className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium">No LinkedIn accounts linked</p>
                <p className="text-xs text-muted-foreground mt-1">Link accounts to use LinkedIn steps in this campaign.</p>
              </CardContent>
            </Card>
          )}
          {linkedinAccounts?.length ? (
            <div>
              <Label className="text-xs">Link a LinkedIn Account</Label>
              <Select onValueChange={(val) => linkLinkedin.mutate({ campaignId: id!, linkedinAccountId: val })}>
                <SelectTrigger className="mt-1 h-9 text-sm w-64"><SelectValue placeholder="Select account..." /></SelectTrigger>
                <SelectContent>
                  {linkedinAccounts
                    .filter((a: any) => !campaignLinkedinAccounts?.some((c: any) => c.linkedin_account_id === a.id))
                    .map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{a.profile_name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </TabsContent>

        {/* ── Analytics Tab ── */}
        <TabsContent value="analytics">
          <CampaignAnalyticsTab campaignId={id!} />
        </TabsContent>

        {/* ── Settings Tab ── */}
        <TabsContent value="settings">
          <Card>
            <CardHeader><CardTitle className="text-sm">Campaign Settings</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Daily Sending Limit</Label>
                <Input type="number" defaultValue={campaign.daily_limit || 50} className="mt-1 h-9 text-sm w-32"
                  onBlur={(e) => updateCampaign.mutate({ id: id!, daily_limit: parseInt(e.target.value) || 50 })} />
              </div>
              <div>
                <Label className="text-xs">Max New Leads / Day</Label>
                <Input type="number" defaultValue={campaign.max_new_leads_per_day || 30} className="mt-1 h-9 text-sm w-32"
                  onBlur={(e) => updateCampaign.mutate({ id: id!, max_new_leads_per_day: parseInt(e.target.value) || 30 })} />
              </div>
              <div>
                <Label className="text-xs">Min Wait (minutes)</Label>
                <Input type="number" defaultValue={campaign.min_wait_minutes || 3} className="mt-1 h-9 text-sm w-32"
                  onBlur={(e) => updateCampaign.mutate({ id: id!, min_wait_minutes: parseInt(e.target.value) || 3 })} />
              </div>
              <div>
                <Label className="text-xs">Random Wait (minutes)</Label>
                <Input type="number" defaultValue={campaign.random_wait_minutes || 5} className="mt-1 h-9 text-sm w-32"
                  onBlur={(e) => updateCampaign.mutate({ id: id!, random_wait_minutes: parseInt(e.target.value) || 5 })} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Step Dialog */}
      <Dialog open={addStepOpen} onOpenChange={setAddStepOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Add Campaign Step</DialogTitle>
            <DialogDescription className="text-sm">Add a new action to the campaign workflow.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Step Type</Label>
              <Select value={newStepType} onValueChange={setNewStepType}>
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
                <Input type="number" value={newDelayDays} onChange={(e) => setNewDelayDays(parseInt(e.target.value) || 0)} className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Delay (hours)</Label>
                <Input type="number" value={newDelayHours} onChange={(e) => setNewDelayHours(parseInt(e.target.value) || 0)} className="mt-1 h-9 text-sm" />
              </div>
            </div>
            {newStepType === "email" && (
              <div>
                <Label className="text-xs">Email Template</Label>
                <Select value={newTemplateId} onValueChange={setNewTemplateId}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="Select template..." /></SelectTrigger>
                  <SelectContent>
                    {templates?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {newStepType === "linkedin_message" && (
              <div>
                <Label className="text-xs">LinkedIn Message Template</Label>
                <Select value={newLinkedinTemplateId} onValueChange={setNewLinkedinTemplateId}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="Select template..." /></SelectTrigger>
                  <SelectContent>
                    {linkedinTemplates?.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(newStepType === "task" || newStepType === "linkedin_connect" || newStepType === "linkedin_message") && (
              <div>
                <Label className="text-xs">Task Description</Label>
                <Textarea value={newTaskDesc} onChange={(e) => setNewTaskDesc(e.target.value)} className="mt-1 text-sm" rows={2} placeholder="Describe the action..." />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddStepOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddStep} disabled={addStep.isPending}>
              {addStep.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Add Step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enroll Dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Enroll Contacts</DialogTitle>
            <DialogDescription className="text-sm">Paste contact IDs (one per line or comma-separated) to enroll them in this campaign.</DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs">Contact IDs</Label>
            <Textarea value={enrollContactIds} onChange={(e) => setEnrollContactIds(e.target.value)} className="mt-1 text-sm font-mono" rows={6} placeholder="paste contact UUIDs..." />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEnrollOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleEnroll} disabled={enrollContacts.isPending}>
              {enrollContacts.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Enroll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
