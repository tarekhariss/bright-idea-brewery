import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Loader2,
  GitMerge,
  UserPlus,
  SkipForward,
  Clock,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import {
  type ReviewAction,
  type DuplicateClassification,
  buildActivityLog,
  calculateDataQualityScore,
} from "@/lib/csv-utils";
import type { Json } from "@/integrations/supabase/db-types";

interface ImportRowData {
  id: string;
  row_number: number;
  raw_data: Record<string, unknown>;
  normalized_data: Record<string, unknown> | null;
  status: string;
  duplicate_match_reason: string | null;
  review_required: boolean;
  action_taken: string | null;
  contact_id: string | null;
  company_id: string | null;
}

interface MatchedContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  secondary_email: string | null;
  job_title: string | null;
  company_name_raw: string | null;
  linkedin_url: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  department: string | null;
  seniority_level: string | null;
  data_quality_score: number | null;
  [key: string]: unknown;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: ImportRowData | null;
  importJobId: string;
  onResolved: () => void;
}

const REVIEW_ACTIONS: { value: ReviewAction; label: string; icon: React.ElementType; desc: string }[] = [
  { value: "create_new", label: "Create as New", icon: UserPlus, desc: "Insert as a new contact record" },
  { value: "link_existing", label: "Link to Existing", icon: Link2, desc: "Associate this import row with the matched record" },
  { value: "update_existing", label: "Update Existing", icon: GitMerge, desc: "Merge imported fields into the existing record" },
  { value: "skip", label: "Skip Row", icon: SkipForward, desc: "Do not import this row" },
  { value: "review_later", label: "Review Later", icon: Clock, desc: "Keep flagged for future review" },
];

const COMPARE_FIELDS = [
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "secondary_email", label: "Secondary Email" },
  { key: "job_title", label: "Job Title" },
  { key: "department", label: "Department" },
  { key: "seniority_level", label: "Seniority" },
  { key: "company_name_raw", label: "Company" },
  { key: "linkedin_url", label: "LinkedIn" },
  { key: "phone", label: "Phone" },
  { key: "country", label: "Country" },
  { key: "city", label: "City" },
];

export function ImportReviewPanel({ open, onOpenChange, row, importJobId, onResolved }: Props) {
  const [action, setAction] = useState<ReviewAction>("create_new");
  const [fieldPreferences, setFieldPreferences] = useState<Record<string, "imported" | "existing">>({});
  const [matchedContact, setMatchedContact] = useState<MatchedContact | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load matched contact when panel opens
  const loadMatchedContact = useCallback(async (contactId: string) => {
    setLoadingMatch(true);
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", contactId)
        .single();
      if (!error && data) setMatchedContact(data as unknown as MatchedContact);
    } catch {
      // ignore
    } finally {
      setLoadingMatch(false);
    }
  }, []);

  // Trigger load when row changes
  useState(() => {
    if (row?.normalized_data) {
      const matchId = (row.normalized_data as Record<string, unknown>)?.__matched_contact_id as string;
      // Try extracting from duplicate_match_reason or check contact_id
      if (row.contact_id) loadMatchedContact(row.contact_id);
    }
  });

  const importedData = (row?.normalized_data ?? row?.raw_data ?? {}) as Record<string, unknown>;

  const handleResolve = async () => {
    if (!row) return;
    setSubmitting(true);

    try {
      let newStatus = "pending";
      let actionTakenStr = action as string;
      let contactId = row.contact_id;

      if (action === "skip") {
        newStatus = "skipped";
        actionTakenStr = "skipped_by_reviewer";
      } else if (action === "review_later") {
        newStatus = "review";
        actionTakenStr = "deferred_review";
      } else if (action === "create_new") {
        const insertData: Record<string, unknown> = {};
        COMPARE_FIELDS.forEach((f) => {
          const val = importedData[f.key];
          if (val !== null && val !== undefined && val !== "") insertData[f.key] = val;
        });
        insertData.data_quality_score = calculateDataQualityScore(importedData);

        const { data: newContact, error } = await supabase
          .from("contacts")
          .insert(insertData as any)
          .select("id")
          .single();

        if (error) throw error;
        contactId = (newContact as any)?.id ?? null;
        newStatus = "success";
        actionTakenStr = "created_new_contact";

        if (contactId) {
          await (supabase.from("contact_activity_log") as any).insert({
            contact_id: contactId,
            action: "created_from_import",
            details: buildActivityLog("created_from_import", importJobId, row.row_number).details as unknown as Json,
          });
        }
      } else if (action === "link_existing" && matchedContact) {
        contactId = matchedContact.id;
        newStatus = "success";
        actionTakenStr = "linked_to_existing";

        await (supabase.from("contact_activity_log") as any).insert({
          contact_id: matchedContact.id,
          action: "linked_from_import",
          details: buildActivityLog("linked_from_import", importJobId, row.row_number).details as unknown as Json,
        });
      } else if (action === "update_existing" && matchedContact) {
        const updateData: Record<string, unknown> = {};
        let updated = false;

        COMPARE_FIELDS.forEach((f) => {
          const pref = fieldPreferences[f.key] ?? "existing";
          if (pref === "imported") {
            const importedVal = importedData[f.key];
            if (importedVal !== null && importedVal !== undefined && importedVal !== "") {
              updateData[f.key] = importedVal;
              updated = true;
            }
          }
        });

        const merged = { ...matchedContact, ...updateData };
        updateData.data_quality_score = calculateDataQualityScore(merged as Record<string, unknown>);

        if (updated) {
          const { error } = await (supabase
            .from("contacts") as any)
            .update(updateData)
            .eq("id", matchedContact.id);
          if (error) throw error;
        }

        contactId = matchedContact.id;
        newStatus = "success";
        actionTakenStr = "updated_existing_contact";

        await (supabase.from("contact_activity_log") as any).insert({
          contact_id: matchedContact.id,
          action: "updated_from_import",
          details: {
            ...buildActivityLog("updated_from_import", importJobId, row.row_number).details,
            fields_updated: Object.keys(updateData),
          } as unknown as Json,
        });
      }

      await (supabase.from("import_job_rows") as any)
        .update({
          status: newStatus,
          action_taken: actionTakenStr,
          review_required: action === "review_later",
          contact_id: contactId,
        })
        .eq("id", row.id);

      toast.success(`Row #${row.row_number} resolved: ${action.replace(/_/g, " ")}`);
      onResolved();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to resolve row");
    } finally {
      setSubmitting(false);
    }
  };

  if (!row) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-primary" />
            Review Row #{row.row_number}
          </SheetTitle>
          <SheetDescription>
            {row.duplicate_match_reason || "Review this row and choose an action"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Match confidence */}
          {row.duplicate_match_reason && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-200">
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-200">
                Match Found
              </Badge>
              <span className="text-sm">{row.duplicate_match_reason}</span>
            </div>
          )}

          {/* Side-by-side comparison */}
          <div>
            <p className="text-sm font-semibold mb-3">Field Comparison</p>
            <ScrollArea className="max-h-[350px]">
              <div className="space-y-1">
                {/* Header */}
                <div className="grid grid-cols-[140px_1fr_1fr_80px] gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground">
                  <span>Field</span>
                  <span>Imported</span>
                  <span>Existing</span>
                  <span>Prefer</span>
                </div>
                <Separator />

                {COMPARE_FIELDS.map((f) => {
                  const importedVal = String(importedData[f.key] ?? "");
                  const existingVal = matchedContact ? String(matchedContact[f.key] ?? "") : "";
                  const isDifferent = importedVal && existingVal && importedVal.toLowerCase() !== existingVal.toLowerCase();
                  const importedEmpty = !importedVal;
                  const existingEmpty = !existingVal;

                  return (
                    <div
                      key={f.key}
                      className={`grid grid-cols-[140px_1fr_1fr_80px] gap-2 px-3 py-2 rounded text-sm ${
                        isDifferent ? "bg-amber-500/5" : ""
                      }`}
                    >
                      <span className="text-muted-foreground text-xs font-medium">{f.label}</span>
                      <span className={`text-xs truncate ${importedEmpty ? "text-muted-foreground/50" : isDifferent ? "font-medium text-primary" : ""}`}>
                        {importedVal || "—"}
                      </span>
                      <span className={`text-xs truncate ${existingEmpty ? "text-muted-foreground/50" : ""}`}>
                        {existingVal || "—"}
                      </span>
                      <div>
                        {action === "update_existing" && isDifferent && (
                          <select
                            className="text-xs border rounded px-1 py-0.5 bg-background"
                            value={fieldPreferences[f.key] ?? "existing"}
                            onChange={(e) =>
                              setFieldPreferences((prev) => ({
                                ...prev,
                                [f.key]: e.target.value as "imported" | "existing",
                              }))
                            }
                          >
                            <option value="existing">Keep</option>
                            <option value="imported">Import</option>
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          <Separator />

          {/* Action selection */}
          <div>
            <p className="text-sm font-semibold mb-3">Choose Action</p>
            <RadioGroup value={action} onValueChange={(v) => setAction(v as ReviewAction)}>
              <div className="space-y-2">
                {REVIEW_ACTIONS.map((a) => (
                  <label
                    key={a.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                      action === a.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                    }`}
                  >
                    <RadioGroupItem value={a.value} className="mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <a.icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{a.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Action summary */}
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Action Summary</p>
              <p className="text-sm">
                {action === "create_new" && "A new contact record will be created from this imported data."}
                {action === "link_existing" && "This import row will be linked to the existing matched contact without changing any fields."}
                {action === "update_existing" && `The existing contact will be updated with ${Object.values(fieldPreferences).filter((v) => v === "imported").length} imported field(s).`}
                {action === "skip" && "This row will be skipped and no changes will be made."}
                {action === "review_later" && "This row will stay flagged for review. You can resolve it later."}
              </p>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="flex-1 gap-2" onClick={handleResolve} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? "Resolving…" : "Apply Action"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
