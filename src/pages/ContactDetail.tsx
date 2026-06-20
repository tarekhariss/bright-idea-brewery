import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles, useOwnerName } from "@/hooks/use-profiles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Mail, Phone, Linkedin, MapPin, Building2, Calendar, Shield, ExternalLink, User, UserPlus, Brain, TrendingUp } from "lucide-react";
import { LifecycleBadge, OutreachBadge, EmailValidityBadge, QualityScoreBadge, DncBadge } from "@/components/data-table/StatusBadge";
import { format } from "date-fns";
import { toast } from "sonner";
import { PushToCrmButton } from "@/components/crm/PushToCrmButton";
import { IntelligenceTab } from "@/components/intelligence/IntelligenceTab";
import { AttributionSection } from "@/components/analytics/AttributionSection";
import { useContactAttribution } from "@/hooks/use-analytics";
import type { Database } from "@/integrations/supabase/db-types";

type Contact = Database["public"]["Tables"]["contacts"]["Row"];
type ActivityLog = Database["public"]["Tables"]["contact_activity_log"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];
type Tag = Database["public"]["Tables"]["tags"]["Row"];

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const { profiles, getName } = useProfiles();
  const [contact, setContact] = useState<Contact | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    async function load() {
      setLoading(true);
      const { data: contactData } = await supabase.from("contacts").select("*").eq("id", id!).maybeSingle();
      const typedContact = contactData as Contact | null;
      setContact(typedContact);

      if (typedContact?.company_id) {
        const { data: co } = await supabase.from("companies").select("*").eq("id", typedContact.company_id).maybeSingle();
        setCompany(co as Company | null);
      }

      const { data: acts } = await supabase
        .from("contact_activity_log")
        .select("*")
        .eq("contact_id", id!)
        .order("created_at", { ascending: false })
        .limit(50);
      setActivities(acts ?? []);

      const { data: tagLinks } = await supabase
        .from("contact_tags")
        .select("tag_id")
        .eq("contact_id", id!);
      if (tagLinks && tagLinks.length > 0) {
        const tagIds = tagLinks.map((t: { tag_id: string }) => t.tag_id);
        const { data: tagData } = await supabase
          .from("tags")
          .select("*")
          .in("id", tagIds);
        setTags(tagData ?? []);
      }

      setLoading(false);
    }
    load();
  }, [id]);

  const fmt = (d: string | null) => {
    if (!d) return "—";
    try { return format(new Date(d), "MMM d, yyyy 'at' h:mm a"); } catch { return "—"; }
  };
  const fmtShort = (d: string | null) => {
    if (!d) return "—";
    try { return format(new Date(d), "MMM d, yyyy"); } catch { return "—"; }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-muted-foreground">Contact not found</p>
        <Button variant="outline" onClick={() => navigate("/contacts")}>Back to Contacts</Button>
      </div>
    );
  }

  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unnamed Contact";

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto animate-fade-in">
      {/* Back nav */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/contacts")} className="gap-1.5 text-xs -ml-2 text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Contacts
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{fullName}</h1>
                <DncBadge dnc={contact.do_not_contact} />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {contact.job_title && <span>{contact.job_title}</span>}
                {contact.job_title && contact.company_name_raw && <span>·</span>}
                {contact.company_name_raw && (
                  contact.company_id ? (
                    <Link to={`/companies/${contact.company_id}`} className="text-primary hover:underline">{contact.company_name_raw}</Link>
                  ) : (
                    <span>{contact.company_name_raw}</span>
                  )
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <LifecycleBadge status={contact.lifecycle_status} />
            <OutreachBadge status={contact.outreach_status} />
            <EmailValidityBadge status={contact.email_validity_status} />
            <CanonicalStatusBadge contact={contact} />
            <ModifierChips contact={contact} />
            <QualityScoreBadge score={contact.data_quality_score} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {contact?.id && (
            <PushToCrmButton
              contactId={contact.id}
              companyId={contact.company_id ?? null}
              sourceChannel="manual_push"
              defaultTitle={`${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || contact.email || undefined}
            />
          )}
          {canEdit && <Button variant="outline" size="sm" className="text-xs">Edit Contact</Button>}
        </div>
      </div>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
          <TabsTrigger value="intelligence" className="text-xs gap-1.5"><Brain className="h-3 w-3" /> Intelligence</TabsTrigger>
          <TabsTrigger value="attribution" className="text-xs gap-1.5"><TrendingUp className="h-3 w-3" /> Attribution</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Details */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Contact Information</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="Primary Email" value={contact.email} />
              {contact.secondary_email && <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="Secondary Email" value={contact.secondary_email} />}
              {contact.tertiary_email && <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="Tertiary Email" value={contact.tertiary_email} />}
              <Separator />
              <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={contact.phone} />
              {contact.work_direct_phone && <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Direct" value={contact.work_direct_phone} />}
              {contact.mobile_phone && <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Mobile" value={contact.mobile_phone} />}
              {contact.corporate_phone && <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Corporate" value={contact.corporate_phone} />}
              <Separator />
              {contact.linkedin_url && (
                <InfoRow icon={<Linkedin className="h-3.5 w-3.5" />} label="LinkedIn" value={contact.linkedin_url} link />
              )}
              <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={[contact.city, contact.state, contact.country].filter(Boolean).join(", ") || null} />
            </CardContent>
          </Card>

          {/* Professional Details */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Professional Details</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <DetailField label="Job Title" value={contact.job_title} />
                <DetailField label="Department" value={contact.department} />
                <DetailField label="Seniority" value={contact.seniority_level} />
                <DetailField label="Email Confidence" value={contact.email_confidence !== null ? `${contact.email_confidence}%` : null} />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {contact.notes && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.notes}</p></CardContent>
            </Card>
          )}

          {/* Activity Log */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Activity Log</CardTitle></CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {activities.map((a) => (
                    <div key={a.id} className="flex items-start gap-3">
                      <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{a.action}</p>
                        {a.details && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {typeof a.details === "string" ? a.details : JSON.stringify(a.details)}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5">{fmt(a.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Owner */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium flex items-center gap-1.5"><UserPlus className="h-3.5 w-3.5" /> Owner</CardTitle></CardHeader>
            <CardContent>
              {canEdit ? (
                <Select
                  value={contact.owner_id || "unassigned"}
                  onValueChange={async (val) => {
                    const ownerId = val === "unassigned" ? null : val;
                    // @ts-ignore
                    await supabase.from("contacts").update({ owner_id: ownerId }).eq("id", contact.id);
                    setContact({ ...contact, owner_id: ownerId });
                    toast.success("Owner updated");
                  }}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || p.id.slice(0, 8)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm">{getName(contact.owner_id)}</p>
              )}
            </CardContent>
          </Card>
          {/* Tags */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Tags</CardTitle></CardHeader>
            <CardContent>
              {tags.length === 0 ? (
                <p className="text-xs text-muted-foreground">No tags assigned.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <Badge key={t.id} variant="secondary" className="text-[11px]" style={t.color ? { backgroundColor: `${t.color}20`, color: t.color, borderColor: `${t.color}40` } : undefined}>
                      {t.name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Metadata</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <DetailField label="Created By" value={getName(contact.created_by)} />
              <DetailField label="Source" value={contact.source} />
              <DetailField label="Source File" value={contact.source_file} />
              <DetailField label="External Source" value={contact.external_source} />
              <DetailField label="External ID" value={contact.external_contact_id} />
              <Separator />
              <DetailField label="Last Verified" value={fmtShort(contact.last_verified_at)} />
              <DetailField label="Last Contacted" value={fmtShort(contact.last_contacted_at)} />
              <DetailField label="Created" value={fmt(contact.created_at)} />
              <DetailField label="Updated" value={fmt(contact.updated_at)} />
            </CardContent>
          </Card>

          {/* Related Company */}
          {company && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Linked Company
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link to={`/companies/${company.id}`} className="group">
                  <p className="text-sm font-medium group-hover:text-primary transition-colors">{company.name}</p>
                  {company.domain && <p className="text-xs text-muted-foreground">{company.domain}</p>}
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                    {company.industry && <span>{company.industry}</span>}
                    {company.country && <span>· {company.country}</span>}
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
        </TabsContent>

        <TabsContent value="intelligence">
          <IntelligenceTab contactId={id} />
        </TabsContent>

        <TabsContent value="attribution">
          <ContactAttributionWrapper contactId={id || null} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ icon, label, value, link }: { icon: React.ReactNode; label: string; value: string | null; link?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {link && value ? (
          <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1 truncate">
            {value} <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : (
          <p className="text-sm truncate">{value ?? "—"}</p>
        )}
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm">{value ?? "—"}</p>
    </div>
  );
}

function ContactAttributionWrapper({ contactId }: { contactId: string | null }) {
  const { data } = useContactAttribution(contactId);
  return <AttributionSection attributions={data || []} title="Contact Attribution" />;
}
