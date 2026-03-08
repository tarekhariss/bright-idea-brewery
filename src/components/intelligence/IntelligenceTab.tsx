import { useState } from "react";
import {
  Brain, Sparkles, Target, Lightbulb, AlertCircle, Zap,
  FileText, Plus, Loader2, Trash2, Clock, CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  useResearchProfile, useCreateResearchProfile, useUpdateResearchProfile,
  usePersonalizationVariables, useUpsertPersonalizationVariable, useDeletePersonalizationVariable,
  useGeneratedContent, useCreateGeneratedContent,
  useContactInsights, useCompanyInsights,
} from "@/hooks/use-intelligence";

const statusIcon = (s: string) => {
  if (s === "completed") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
  if (s === "failed") return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
};

interface IntelligenceTabProps {
  contactId?: string;
  companyId?: string;
}

export function IntelligenceTab({ contactId, companyId }: IntelligenceTabProps) {
  const { data: profile, isLoading: loadingProfile } = useResearchProfile(contactId, companyId);
  const { data: variables } = usePersonalizationVariables(contactId, companyId);
  const { data: content } = useGeneratedContent(contactId, companyId);
  const { data: contactInsight } = useContactInsights(contactId);
  const { data: companyInsight } = useCompanyInsights(companyId);

  const createProfile = useCreateResearchProfile();
  const updateProfile = useUpdateResearchProfile();
  const upsertVar = useUpsertPersonalizationVariable();
  const deleteVar = useDeletePersonalizationVariable();
  const createContent = useCreateGeneratedContent();

  const [addVarOpen, setAddVarOpen] = useState(false);
  const [varKey, setVarKey] = useState("");
  const [varValue, setVarValue] = useState("");
  const [genOpen, setGenOpen] = useState(false);
  const [genType, setGenType] = useState("email_subject");
  const [genText, setGenText] = useState("");

  const insight = contactInsight || companyInsight;

  if (loadingProfile) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4">
      {/* Insight Scores */}
      {insight && (
        <div className="grid grid-cols-3 gap-3">
          {contactInsight && (
            <>
              <ScoreCard label="Fit Score" value={contactInsight.fit_score} />
              <ScoreCard label="Personalization" value={contactInsight.personalization_score} />
              <ScoreCard label="Readiness" value={contactInsight.readiness_score} />
            </>
          )}
          {companyInsight && (
            <>
              <ScoreCard label="Fit Score" value={companyInsight.fit_score} />
              <ScoreCard label="Industry Score" value={companyInsight.industry_score} />
              <ScoreCard label="Outreach Priority" value={companyInsight.outreach_priority_score} />
            </>
          )}
        </div>
      )}

      {/* Research */}
      {!profile ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <Brain className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium">No intelligence data</p>
            <p className="text-xs text-muted-foreground mt-1">Create a research profile to start.</p>
            <Button size="sm" className="mt-3 text-xs gap-1.5" onClick={() => createProfile.mutate({
              contact_id: contactId, company_id: companyId, research_status: "pending",
            })}>
              {createProfile.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create Research Profile
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2">
            {statusIcon(profile.research_status)}
            <Badge className="text-[10px] capitalize">{profile.research_status}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ResearchField icon={<FileText className="h-3.5 w-3.5" />} title="Summary" value={profile.summary}
              onSave={(val) => updateProfile.mutate({ id: profile.id, summary: val })} />
            <ResearchField icon={<AlertCircle className="h-3.5 w-3.5" />} title="Pain Points" value={profile.pain_points}
              onSave={(val) => updateProfile.mutate({ id: profile.id, pain_points: val })} />
            <ResearchField icon={<Lightbulb className="h-3.5 w-3.5" />} title="Value Props" value={profile.value_props}
              onSave={(val) => updateProfile.mutate({ id: profile.id, value_props: val })} />
            <ResearchField icon={<Zap className="h-3.5 w-3.5" />} title="Recent Signals" value={profile.recent_signals}
              onSave={(val) => updateProfile.mutate({ id: profile.id, recent_signals: val })} />
          </div>
        </>
      )}

      {/* Variables */}
      {variables && variables.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs">Personalization Variables ({variables.length})</CardTitle>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setAddVarOpen(true)}>
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {variables.map((v: any) => (
                <div key={v.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/30">
                  <code className="font-mono text-[10px] text-primary">{`{{${v.variable_key}}}`}</code>
                  <span className="flex-1 truncate text-muted-foreground">{v.variable_value}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => deleteVar.mutate(v.id)}>
                    <Trash2 className="h-2.5 w-2.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Content */}
      {content && content.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">Generated Content ({content.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {content.slice(0, 5).map((c: any) => (
              <div key={c.id} className="p-2 rounded border bg-muted/30">
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge variant="secondary" className="text-[10px]">{c.content_type}</Badge>
                  {statusIcon(c.generation_status)}
                </div>
                <p className="text-xs whitespace-pre-wrap line-clamp-3">{c.generated_text || "Awaiting..."}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!variables?.length && (
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setAddVarOpen(true)}>
            <Sparkles className="h-3.5 w-3.5" /> Add Variable
          </Button>
        )}
        <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setGenOpen(true)}>
          <Sparkles className="h-3.5 w-3.5" /> Generate Content
        </Button>
      </div>

      {/* Add Variable Dialog */}
      <Dialog open={addVarOpen} onOpenChange={setAddVarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Add Variable</DialogTitle>
            <DialogDescription className="text-sm">Add a personalization variable.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Key</Label>
              <Input value={varKey} onChange={(e) => setVarKey(e.target.value)} placeholder="pain_point" className="mt-1 h-9 text-sm font-mono" />
            </div>
            <div>
              <Label className="text-xs">Value</Label>
              <Textarea value={varValue} onChange={(e) => setVarValue(e.target.value)} className="mt-1 text-sm" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddVarOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={async () => {
              if (!varKey.trim()) return;
              await upsertVar.mutateAsync({ contact_id: contactId, company_id: companyId, variable_key: varKey.trim(), variable_value: varValue, source: "manual" });
              setAddVarOpen(false); setVarKey(""); setVarValue("");
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Generate Content</DialogTitle>
            <DialogDescription className="text-sm">Save generated content.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Type</Label>
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
              <Label className="text-xs">Content</Label>
              <Textarea value={genText} onChange={(e) => setGenText(e.target.value)} className="mt-1 text-sm min-h-[100px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={async () => {
              await createContent.mutateAsync({ contact_id: contactId, company_id: companyId, content_type: genType, generated_text: genText, generation_status: "completed" });
              setGenOpen(false); setGenText("");
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResearchField({ icon, title, value, onSave }: { icon: React.ReactNode; title: string; value: string | null; onSave: (val: string) => void }) {
  return (
    <Card>
      <CardHeader className="pb-1"><CardTitle className="text-[11px] flex items-center gap-1.5">{icon} {title}</CardTitle></CardHeader>
      <CardContent>
        <Textarea defaultValue={value || ""} className="text-xs min-h-[80px]" placeholder={`Enter ${title.toLowerCase()}...`} onBlur={(e) => onSave(e.target.value)} />
      </CardContent>
    </Card>
  );
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-3 pb-2 px-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="flex items-center gap-2 mt-1">
          <Progress value={value} className="flex-1 h-1.5" />
          <span className={`text-sm font-semibold ${value >= 70 ? "text-emerald-600" : value >= 40 ? "text-amber-600" : "text-muted-foreground"}`}>{value}</span>
        </div>
      </CardContent>
    </Card>
  );
}
