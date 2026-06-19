import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/hooks/use-profiles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Globe, Linkedin, Facebook, Twitter, MapPin, Building2, Phone, Users, DollarSign, Cpu, ExternalLink, Hash, UserPlus, Brain, TrendingUp } from "lucide-react";
import { QualityScoreBadge, LifecycleBadge } from "@/components/data-table/StatusBadge";
import { format } from "date-fns";
import { toast } from "sonner";
import { PushToCrmButton } from "@/components/crm/PushToCrmButton";
import { IntelligenceTab } from "@/components/intelligence/IntelligenceTab";
import { AttributionSection } from "@/components/analytics/AttributionSection";
import { useCompanyAttribution } from "@/hooks/use-analytics";
import type { Database, LifecycleStatus } from "@/integrations/supabase/db-types";

type Company = Database["public"]["Tables"]["companies"]["Row"];
type ActivityLog = Database["public"]["Tables"]["company_activity_log"]["Row"];
type Tag = Database["public"]["Tables"]["tags"]["Row"];

interface LinkedContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  job_title: string | null;
  lifecycle_status: LifecycleStatus;
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const { profiles, getName } = useProfiles();
  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<LinkedContact[]>([]);
  const [contactCount, setContactCount] = useState(0);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    async function load() {
      setLoading(true);
      const { data: co } = await supabase.from("companies").select("*").eq("id", id).maybeSingle();
      setCompany(co);

      const { data: cts, count } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, job_title, lifecycle_status", { count: "exact" })
        .eq("company_id", id)
        .order("last_name", { ascending: true })
        .limit(20);
      setContacts(cts ?? []);
      setContactCount(count ?? 0);

      const { data: acts } = await supabase
        .from("company_activity_log")
        .select("*")
        .eq("company_id", id)
        .order("created_at", { ascending: false })
        .limit(50);
      setActivities(acts ?? []);

      const { data: tagLinks } = await supabase.from("company_tags").select("tag_id").eq("company_id", id!);
      if (tagLinks && tagLinks.length > 0) {
        const tagIds = tagLinks.map((t: { tag_id: string }) => t.tag_id);
        const { data: tagData } = await supabase.from("tags").select("*").in("id", tagIds);
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
  const fmtMoney = (v: number | null) => {
    if (v === null) return "—";
    if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v.toLocaleString()}`;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-muted-foreground">Company not found</p>
        <Button variant="outline" onClick={() => navigate("/companies")}>Back to Companies</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate("/companies")} className="gap-1.5 text-xs -ml-2 text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Companies
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {company.domain && (
                  <a href={`https://${company.domain}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                    {company.domain} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {company.industry && <span>· {company.industry}</span>}
                {company.country && <span>· {company.country}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <QualityScoreBadge score={company.data_quality_score} />
            {company.employee_range && <Badge variant="outline" className="text-[11px]">{company.employee_range} employees</Badge>}
            {company.revenue_range && <Badge variant="outline" className="text-[11px]">{company.revenue_range}</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {company?.id && (
            <PushToCrmButton
              companyId={company.id}
              sourceChannel="manual_push"
              defaultTitle={company.name ?? undefined}
            />
          )}
          {canEdit && <Button variant="outline" size="sm" className="text-xs">Edit Company</Button>}
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
        <div className="lg:col-span-2 space-y-6">
          {/* Company Info */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Company Information</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <InfoRow icon={<Globe className="h-3.5 w-3.5" />} label="Website" value={company.website} link />
              <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={company.company_phone} />
              {company.company_linkedin_url && <InfoRow icon={<Linkedin className="h-3.5 w-3.5" />} label="LinkedIn" value={company.company_linkedin_url} link />}
              {company.facebook_url && <InfoRow icon={<Facebook className="h-3.5 w-3.5" />} label="Facebook" value={company.facebook_url} link />}
              {company.twitter_url && <InfoRow icon={<Twitter className="h-3.5 w-3.5" />} label="Twitter" value={company.twitter_url} link />}
              <Separator />
              <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Address" value={[company.company_address, company.company_city, company.company_state, company.company_country].filter(Boolean).join(", ") || [company.city, company.state, company.country].filter(Boolean).join(", ") || null} />
            </CardContent>
          </Card>

          {/* Size & Financials */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Size & Financials</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard icon={<Users className="h-4 w-4" />} label="Employees" value={company.employee_count?.toLocaleString() ?? company.employee_range ?? "—"} />
                <StatCard icon={<DollarSign className="h-4 w-4" />} label="Annual Revenue" value={fmtMoney(company.annual_revenue)} />
                <StatCard icon={<DollarSign className="h-4 w-4" />} label="Total Funding" value={fmtMoney(company.total_funding)} />
                {company.latest_funding && <StatCard icon={<DollarSign className="h-4 w-4" />} label="Latest Round" value={`${company.latest_funding} ${company.latest_funding_amount ? `(${fmtMoney(company.latest_funding_amount)})` : ""}`} />}
                {company.last_raised_at && <StatCard icon={<Hash className="h-4 w-4" />} label="Last Raised" value={fmtShort(company.last_raised_at)} />}
              </div>
            </CardContent>
          </Card>

          {/* Technologies & Keywords */}
          {((company.technologies && company.technologies.length > 0) || (company.keywords && company.keywords.length > 0)) && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Technologies & Keywords</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {company.technologies && company.technologies.length > 0 && (
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1"><Cpu className="h-3 w-3" /> Technologies</p>
                    <div className="flex flex-wrap gap-1.5">
                      {company.technologies.map((t) => <Badge key={t} variant="secondary" className="text-[11px]">{t}</Badge>)}
                    </div>
                  </div>
                )}
                {company.keywords && company.keywords.length > 0 && (
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1.5">Keywords</p>
                    <div className="flex flex-wrap gap-1.5">
                      {company.keywords.map((k) => <Badge key={k} variant="outline" className="text-[11px]">{k}</Badge>)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {company.notes && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{company.notes}</p></CardContent>
            </Card>
          )}

          {/* Linked Contacts */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Linked Contacts ({contactCount})</CardTitle>
                {contactCount > 20 && (
                  <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => navigate(`/contacts?company_id=${id}`)}>
                    View All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No contacts linked to this company.</p>
              ) : (
                <div className="space-y-2">
                  {contacts.map((c) => (
                    <Link
                      key={c.id}
                      to={`/contacts/${c.id}`}
                      className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                          {[c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[c.job_title, c.email].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <LifecycleBadge status={c.lifecycle_status} />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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
                        {a.details && <p className="text-xs text-muted-foreground mt-0.5 truncate">{typeof a.details === "string" ? a.details : JSON.stringify(a.details)}</p>}
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
                  value={company.owner_id || "unassigned"}
                  onValueChange={async (val) => {
                    const ownerId = val === "unassigned" ? null : val;
                    // @ts-ignore
                    await supabase.from("companies").update({ owner_id: ownerId }).eq("id", company.id);
                    setCompany({ ...company, owner_id: ownerId });
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
                <p className="text-sm">{getName(company.owner_id)}</p>
              )}
            </CardContent>
          </Card>

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

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Metadata</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <DetailField label="External Account ID" value={company.external_account_id} />
              <DetailField label="Email Domain Name" value={company.company_name_for_emails} />
              <Separator />
              <DetailField label="Last Verified" value={fmtShort(company.last_verified_at)} />
              <DetailField label="Created" value={fmt(company.created_at)} />
              <DetailField label="Updated" value={fmt(company.updated_at)} />
            </CardContent>
          </Card>

          {company.description && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Description</CardTitle></CardHeader>
              <CardContent><p className="text-xs text-muted-foreground leading-relaxed">{company.description}</p></CardContent>
            </Card>
          )}
        </div>
      </div>
        </TabsContent>

        <TabsContent value="intelligence">
          <IntelligenceTab companyId={id} />
        </TabsContent>

        <TabsContent value="attribution">
          <CompanyAttributionWrapper companyId={id || null} />
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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3 bg-muted/30">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">{icon}<span className="text-[11px]">{label}</span></div>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function CompanyAttributionWrapper({ companyId }: { companyId: string | null }) {
  const { data } = useCompanyAttribution(companyId);
  return <AttributionSection attributions={data || []} title="Company Attribution" />;
}
