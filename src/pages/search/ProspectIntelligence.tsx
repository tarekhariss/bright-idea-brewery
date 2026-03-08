import { useState } from "react";
import {
  Brain, Sparkles, Target, Lightbulb, FileText, Mail, Linkedin,
  Plus, Trash2, Loader2, AlertCircle, CheckCircle2, Clock, Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useResearchProfile, useCreateResearchProfile, useUpdateResearchProfile,
  usePersonalizationVariables, useUpsertPersonalizationVariable, useDeletePersonalizationVariable,
  useGeneratedContent, useCreateGeneratedContent,
  useAIPromptTemplates, useCreateAIPromptTemplate, useDeleteAIPromptTemplate,
} from "@/hooks/use-intelligence";

const statusIcon = (s: string) => {
  if (s === "completed") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
  if (s === "failed") return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
};

const contentTypeLabel: Record<string, string> = {
  email_subject: "Email Subject",
  email_body: "Email Body",
  linkedin_message: "LinkedIn Message",
  summary: "Summary",
};

export default function ProspectIntelligencePage() {
  const [contactId, setContactId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const activeContactId = contactId || undefined;
  const activeCompanyId = companyId || undefined;

  const { data: profile, isLoading: loadingProfile } = useResearchProfile(activeContactId, activeCompanyId);
  const { data: variables, isLoading: loadingVars } = usePersonalizationVariables(activeContactId, activeCompanyId);
  const { data: content, isLoading: loadingContent } = useGeneratedContent(activeContactId, activeCompanyId);
  const { data: prompts } = useAIPromptTemplates();

  const createProfile = useCreateResearchProfile();
  const updateProfile = useUpdateResearchProfile();
  const upsertVar = useUpsertPersonalizationVariable();
  const deleteVar = useDeletePersonalizationVariable();
  const createContent = useCreateGeneratedContent();
  const createPrompt = useCreateAIPromptTemplate();
  const deletePrompt = useDeleteAIPromptTemplate();

  const [addVarOpen, setAddVarOpen] = useState(false);
  const [varKey, setVarKey] = useState("");
  const [varValue, setVarValue] = useState("");

  const [genOpen, setGenOpen] = useState(false);
  const [genType, setGenType] = useState("email_subject");
  const [genText, setGenText] = useState("");

  const [promptOpen, setPromptOpen] = useState(false);
  const [promptName, setPromptName] = useState("");
  const [promptType, setPromptType] = useState("research");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPromptTpl, setUserPromptTpl] = useState("");

  const hasLookup = !!(activeContactId || activeCompanyId);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
          <Brain className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prospect Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Research leads, generate personalization, and create AI-powered outreach.</p>
        </div>
      </div>

      {/* Lookup */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label className="text-xs">Contact ID</Label>
              <Input value={contactId} onChange={(e) => setContactId(e.target.value)} placeholder="Paste contact UUID..." className="mt-1 h-9 text-sm font-mono" />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Company ID</Label>
              <Input value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="Paste company UUID..." className="mt-1 h-9 text-sm font-mono" />
            </div>
            {hasLookup && !profile && (
              <Button size="sm" className="gap-1.5 text-xs" onClick={() => createProfile.mutate({
                contact_id: activeContactId, company_id: activeCompanyId, research_status: "pending",
              })}>
                <Plus className="h-3.5 w-3.5" /> Create Profile
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!hasLookup ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-20 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium">Enter a Contact or Company ID to begin</p>
            <p className="text-xs text-muted-foreground mt-1">Research, personalization, and generated content will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="research" className="space-y-4">
          <TabsList>
            <TabsTrigger value="research" className="text-xs">Research</TabsTrigger>
            <TabsTrigger value="variables" className="text-xs">Variables ({variables?.length || 0})</TabsTrigger>
            <TabsTrigger value="content" className="text-xs">Generated ({content?.length || 0})</TabsTrigger>
            <TabsTrigger value="prompts" className="text-xs">AI Prompts ({prompts?.length || 0})</TabsTrigger>
          </TabsList>

          {/* ── Research ── */}
          <TabsContent value="research" className="space-y-4">
            {loadingProfile ? (
              <Skeleton className="h-48 w-full" />
            ) : !profile ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center py-16 text-center">
                  <Target className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-medium">No research profile yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Create one to start documenting prospect intelligence.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  {statusIcon(profile.research_status)}
                  <Badge className="text-[10px] capitalize">{profile.research_status}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Summary</CardTitle></CardHeader>
                    <CardContent>
                      <Textarea
                        defaultValue={profile.summary || ""}
                        className="text-sm min-h-[100px]"
                        placeholder="Company/contact summary..."
                        onBlur={(e) => updateProfile.mutate({ id: profile.id, summary: e.target.value })}
                      />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> Pain Points</CardTitle></CardHeader>
                    <CardContent>
                      <Textarea
                        defaultValue={profile.pain_points || ""}
                        className="text-sm min-h-[100px]"
                        placeholder="Key challenges..."
                        onBlur={(e) => updateProfile.mutate({ id: profile.id, pain_points: e.target.value })}
                      />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1.5"><Lightbulb className="h-3.5 w-3.5" /> Value Props</CardTitle></CardHeader>
                    <CardContent>
                      <Textarea
                        defaultValue={profile.value_props || ""}
                        className="text-sm min-h-[100px]"
                        placeholder="Relevant value propositions..."
                        onBlur={(e) => updateProfile.mutate({ id: profile.id, value_props: e.target.value })}
                      />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Recent Signals</CardTitle></CardHeader>
                    <CardContent>
                      <Textarea
                        defaultValue={profile.recent_signals || ""}
                        className="text-sm min-h-[100px]"
                        placeholder="Hiring, funding, news..."
                        onBlur={(e) => updateProfile.mutate({ id: profile.id, recent_signals: e.target.value })}
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Sources */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-xs">Research Sources ({profile.prospect_research_sources?.length || 0})</CardTitle></CardHeader>
                  <CardContent>
                    {profile.prospect_research_sources?.length ? (
                      <div className="space-y-2">
                        {profile.prospect_research_sources.map((s: any) => (
                          <div key={s.id} className="flex items-start gap-3 p-2 rounded border bg-muted/30">
                            <Badge variant="secondary" className="text-[10px] capitalize shrink-0">{s.source_type}</Badge>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium">{s.source_title || "Untitled"}</p>
                              {s.source_url && <a href={s.source_url} className="text-[10px] text-primary truncate block" target="_blank" rel="noopener noreferrer">{s.source_url}</a>}
                              {s.source_content && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{s.source_content}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No sources added yet.</p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ── Variables ── */}
          <TabsContent value="variables" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{variables?.length || 0} personalization variables</p>
              <Button size="sm" className="gap-1.5 text-xs" onClick={() => setAddVarOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Add Variable
              </Button>
            </div>
            {loadingVars ? <Skeleton className="h-32 w-full" /> : !variables?.length ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center py-12 text-center">
                  <Sparkles className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-medium">No variables yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Add personalization variables like company_summary, pain_point, etc.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Variable</TableHead>
                      <TableHead className="text-xs">Value</TableHead>
                      <TableHead className="text-xs">Confidence</TableHead>
                      <TableHead className="text-xs">Source</TableHead>
                      <TableHead className="text-xs w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variables.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell className="text-xs font-mono font-medium">{`{{${v.variable_key}}}`}</TableCell>
                        <TableCell className="text-xs max-w-[300px] truncate">{v.variable_value || "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={v.confidence_score || 0} className="w-12 h-1.5" />
                            <span className="text-[10px] text-muted-foreground">{v.confidence_score || 0}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground">{v.source || "—"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteVar.mutate(v.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* ── Generated Content ── */}
          <TabsContent value="content" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{content?.length || 0} generated items</p>
              <Button size="sm" className="gap-1.5 text-xs" onClick={() => setGenOpen(true)}>
                <Sparkles className="h-3.5 w-3.5" /> Generate Content
              </Button>
            </div>
            {loadingContent ? <Skeleton className="h-32 w-full" /> : !content?.length ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center py-12 text-center">
                  <Mail className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-medium">No generated content</p>
                  <p className="text-xs text-muted-foreground mt-1">Generate personalized emails, LinkedIn messages, and summaries.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {content.map((c: any) => (
                  <Card key={c.id}>
                    <CardContent className="pt-4 pb-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">{contentTypeLabel[c.content_type] || c.content_type}</Badge>
                        {statusIcon(c.generation_status)}
                        <Badge className="text-[10px] capitalize">{c.generation_status}</Badge>
                      </div>
                      <p className="text-sm whitespace-pre-wrap bg-muted/30 rounded p-3 border">{c.generated_text || "Awaiting generation..."}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── AI Prompts ── */}
          <TabsContent value="prompts" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{prompts?.length || 0} prompt templates</p>
              <Button size="sm" className="gap-1.5 text-xs" onClick={() => setPromptOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> New Prompt
              </Button>
            </div>
            {!prompts?.length ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center py-12 text-center">
                  <Brain className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-medium">No AI prompt templates</p>
                  <p className="text-xs text-muted-foreground mt-1">Create configurable prompts for research, personalization, and content generation.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">System Prompt</TableHead>
                      <TableHead className="text-xs w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prompts.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm font-medium">{p.name}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-[10px] capitalize">{p.prompt_type}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">{p.system_prompt || "—"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deletePrompt.mutate(p.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Add Variable Dialog */}
      <Dialog open={addVarOpen} onOpenChange={setAddVarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Add Personalization Variable</DialogTitle>
            <DialogDescription className="text-sm">Create a variable for use in templates.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Variable Key</Label>
              <Input value={varKey} onChange={(e) => setVarKey(e.target.value)} placeholder="pain_point" className="mt-1 h-9 text-sm font-mono" />
            </div>
            <div>
              <Label className="text-xs">Value</Label>
              <Textarea value={varValue} onChange={(e) => setVarValue(e.target.value)} placeholder="Their main challenge is..." className="mt-1 text-sm" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddVarOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={async () => {
              if (!varKey.trim()) return;
              await upsertVar.mutateAsync({ contact_id: activeContactId, company_id: activeCompanyId, variable_key: varKey.trim(), variable_value: varValue, source: "manual" });
              setAddVarOpen(false); setVarKey(""); setVarValue("");
            }} disabled={upsertVar.isPending}>
              {upsertVar.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save Variable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Content Dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Generate Content</DialogTitle>
            <DialogDescription className="text-sm">Save generated AI content for this prospect.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Content Type</Label>
              <Select value={genType} onValueChange={setGenType}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email_subject">Email Subject</SelectItem>
                  <SelectItem value="email_body">Email Body</SelectItem>
                  <SelectItem value="linkedin_message">LinkedIn Message</SelectItem>
                  <SelectItem value="summary">Summary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Generated Text</Label>
              <Textarea value={genText} onChange={(e) => setGenText(e.target.value)} placeholder="Paste or type generated content..." className="mt-1 text-sm min-h-[120px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={async () => {
              await createContent.mutateAsync({
                contact_id: activeContactId, company_id: activeCompanyId,
                content_type: genType, generated_text: genText, generation_status: "completed",
              });
              setGenOpen(false); setGenText("");
            }} disabled={createContent.isPending}>
              {createContent.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save Content
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Prompt Dialog */}
      <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">New AI Prompt Template</DialogTitle>
            <DialogDescription className="text-sm">Configure reusable AI prompts for research and personalization.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={promptName} onChange={(e) => setPromptName(e.target.value)} placeholder="Cold email personalization" className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={promptType} onValueChange={setPromptType}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="research">Research</SelectItem>
                  <SelectItem value="email_personalization">Email Personalization</SelectItem>
                  <SelectItem value="linkedin_message">LinkedIn Message</SelectItem>
                  <SelectItem value="summary">Summary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">System Prompt</Label>
              <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="You are a sales research assistant..." className="mt-1 text-sm" rows={3} />
            </div>
            <div>
              <Label className="text-xs">User Prompt Template</Label>
              <Textarea value={userPromptTpl} onChange={(e) => setUserPromptTpl(e.target.value)} placeholder="Research {{company_name}} and find..." className="mt-1 text-sm" rows={3} />
              <p className="text-[10px] text-muted-foreground mt-1">Use {"{{variable}}"} placeholders</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPromptOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={async () => {
              if (!promptName.trim()) return;
              await createPrompt.mutateAsync({ name: promptName.trim(), prompt_type: promptType, system_prompt: systemPrompt, user_prompt_template: userPromptTpl });
              setPromptOpen(false); setPromptName(""); setSystemPrompt(""); setUserPromptTpl("");
            }} disabled={createPrompt.isPending}>
              {createPrompt.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
