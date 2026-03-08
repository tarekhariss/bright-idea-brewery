import { useState } from "react";
import {
  Map, Plus, Trash2, Edit2, Check, X, Users, Building2, Download, Zap, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

interface FieldMapping {
  key: string;
  label: string;
  dataType: string;
  group: string;
  aliases: string[];
  required?: boolean;
}

const defaultContactMappings: FieldMapping[] = [
  { key: "first_name", label: "First Name", dataType: "text", group: "identity", aliases: ["firstName", "first", "fname", "given_name"], required: true },
  { key: "last_name", label: "Last Name", dataType: "text", group: "identity", aliases: ["lastName", "last", "lname", "surname", "family_name"], required: true },
  { key: "email", label: "Email", dataType: "email", group: "identity", aliases: ["email_address", "e-mail", "emailAddress", "work_email"], required: true },
  { key: "phone", label: "Phone", dataType: "phone", group: "identity", aliases: ["phone_number", "telephone", "mobile", "cell", "direct_phone"] },
  { key: "job_title", label: "Job Title", dataType: "text", group: "identity", aliases: ["title", "position", "role", "jobTitle"] },
  { key: "linkedin_url", label: "LinkedIn URL", dataType: "url", group: "identity", aliases: ["linkedin", "linkedin_profile", "linkedinUrl"] },
  { key: "company_name", label: "Company Name", dataType: "text", group: "identity", aliases: ["company", "organization", "employer", "org"] },
  { key: "lifecycle_status", label: "Lifecycle Status", dataType: "enum", group: "status", aliases: ["status", "lead_status", "stage"] },
  { key: "outreach_status", label: "Outreach Status", dataType: "enum", group: "status", aliases: ["outreach", "contact_status"] },
  { key: "country", label: "Country", dataType: "text", group: "enrichment", aliases: ["country_name", "nation", "location_country"] },
  { key: "city", label: "City", dataType: "text", group: "enrichment", aliases: ["city_name", "location_city"] },
  { key: "state", label: "State", dataType: "text", group: "enrichment", aliases: ["state_name", "province", "region"] },
  { key: "data_quality_score", label: "Data Quality Score", dataType: "number", group: "enrichment", aliases: ["quality_score", "dqs"] },
  { key: "do_not_contact", label: "Do Not Contact", dataType: "boolean", group: "status", aliases: ["dnc", "opt_out", "unsubscribed"] },
  { key: "external_id", label: "External ID", dataType: "text", group: "external", aliases: ["ext_id", "crm_id", "source_id", "record_id"] },
  { key: "source", label: "Source", dataType: "text", group: "enrichment", aliases: ["lead_source", "origin", "acquisition_source"] },
];

const defaultCompanyMappings: FieldMapping[] = [
  { key: "name", label: "Company Name", dataType: "text", group: "identity", aliases: ["company_name", "organization", "org_name", "account_name"], required: true },
  { key: "domain", label: "Domain", dataType: "url", group: "identity", aliases: ["website_domain", "company_domain", "url"] },
  { key: "industry", label: "Industry", dataType: "text", group: "enrichment", aliases: ["sector", "vertical", "business_type"] },
  { key: "employee_count", label: "Employee Count", dataType: "number", group: "enrichment", aliases: ["employees", "headcount", "size", "num_employees"] },
  { key: "employee_range", label: "Employee Range", dataType: "text", group: "enrichment", aliases: ["company_size", "size_range"] },
  { key: "revenue_range", label: "Revenue Range", dataType: "text", group: "enrichment", aliases: ["revenue", "annual_revenue"] },
  { key: "country", label: "Country", dataType: "text", group: "enrichment", aliases: ["hq_country", "headquarters_country"] },
  { key: "city", label: "City", dataType: "text", group: "enrichment", aliases: ["hq_city", "headquarters_city"] },
  { key: "website", label: "Website", dataType: "url", group: "identity", aliases: ["company_website", "homepage", "url"] },
  { key: "linkedin_url", label: "LinkedIn URL", dataType: "url", group: "identity", aliases: ["linkedin", "company_linkedin"] },
  { key: "description", label: "Description", dataType: "text", group: "enrichment", aliases: ["about", "company_description", "overview"] },
  { key: "external_id", label: "External ID", dataType: "text", group: "external", aliases: ["ext_id", "crm_id", "account_id"] },
];

const groupLabels: Record<string, { label: string; icon: any }> = {
  identity: { label: "Identity Fields", icon: Users },
  status: { label: "Status Fields", icon: Zap },
  enrichment: { label: "Enrichment Fields", icon: Download },
  external: { label: "External IDs", icon: Link2 },
};

const typeColors: Record<string, string> = {
  text: "bg-primary/10 text-primary",
  email: "bg-[hsl(var(--chart-2))]/10 text-[hsl(var(--chart-2))]",
  phone: "bg-[hsl(var(--chart-3))]/10 text-[hsl(var(--chart-3))]",
  url: "bg-[hsl(var(--chart-4))]/10 text-[hsl(var(--chart-4))]",
  number: "bg-[hsl(var(--chart-1))]/10 text-[hsl(var(--chart-1))]",
  enum: "bg-[hsl(var(--chart-5))]/10 text-[hsl(var(--chart-5))]",
  boolean: "bg-muted text-muted-foreground",
};

export default function FieldMappingsPage() {
  const [contactMappings, setContactMappings] = useState<FieldMapping[]>(defaultContactMappings);
  const [companyMappings, setCompanyMappings] = useState<FieldMapping[]>(defaultCompanyMappings);
  const [editingAlias, setEditingAlias] = useState<{ objectType: string; fieldKey: string } | null>(null);
  const [newAlias, setNewAlias] = useState("");
  const [addAliasDialog, setAddAliasDialog] = useState<{ objectType: string; fieldKey: string } | null>(null);

  const getMappings = (type: string) => type === "contacts" ? contactMappings : companyMappings;
  const setMappings = (type: string) => type === "contacts" ? setContactMappings : setCompanyMappings;

  const addAlias = (objectType: string, fieldKey: string, alias: string) => {
    const trimmed = alias.trim().toLowerCase();
    if (!trimmed) return;
    const setter = setMappings(objectType);
    setter((prev) =>
      prev.map((m) =>
        m.key === fieldKey && !m.aliases.includes(trimmed)
          ? { ...m, aliases: [...m.aliases, trimmed] }
          : m
      )
    );
    setNewAlias("");
  };

  const removeAlias = (objectType: string, fieldKey: string, alias: string) => {
    const setter = setMappings(objectType);
    setter((prev) =>
      prev.map((m) =>
        m.key === fieldKey ? { ...m, aliases: m.aliases.filter((a) => a !== alias) } : m
      )
    );
  };

  const renderMappingTable = (objectType: string, group: string) => {
    const mappings = getMappings(objectType).filter((m) => m.group === group);
    const groupInfo = groupLabels[group];
    const GroupIcon = groupInfo.icon;

    return (
      <Card key={group}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <GroupIcon className="h-4 w-4 text-muted-foreground" />
            {groupInfo.label}
          </CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Field</TableHead>
              <TableHead className="w-[80px]">Type</TableHead>
              <TableHead>Mapped Aliases</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.map((m) => (
              <TableRow key={m.key}>
                <TableCell className="font-medium">
                  {m.label}
                  {m.required && <span className="text-destructive ml-1">*</span>}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={`text-[10px] ${typeColors[m.dataType] || ""}`}>
                    {m.dataType}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {m.aliases.map((alias) => (
                      <Badge key={alias} variant="outline" className="text-xs font-mono gap-1 group">
                        {alias}
                        <button
                          onClick={() => removeAlias(objectType, m.key, alias)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    {m.aliases.length === 0 && (
                      <span className="text-xs text-muted-foreground">No aliases</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setAddAliasDialog({ objectType, fieldKey: m.key })}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    );
  };

  const coverageStats = (objectType: string) => {
    const mappings = getMappings(objectType);
    const withAliases = mappings.filter((m) => m.aliases.length > 0).length;
    return { total: mappings.length, covered: withAliases, pct: Math.round((withAliases / mappings.length) * 100) };
  };

  const contactCoverage = coverageStats("contacts");
  const companyCoverage = coverageStats("companies");

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Map className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Field Mappings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Map external CSV headers and data source fields to internal platform fields.</p>
          </div>
        </div>
      </div>

      {/* Coverage cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Contact Mappings</p>
              </div>
              <span className="text-sm text-muted-foreground">{contactCoverage.covered}/{contactCoverage.total} fields</span>
            </div>
            <Progress value={contactCoverage.pct} className="h-2" />
            <p className="text-xs text-muted-foreground">{contactCoverage.pct}% alias coverage</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Company Mappings</p>
              </div>
              <span className="text-sm text-muted-foreground">{companyCoverage.covered}/{companyCoverage.total} fields</span>
            </div>
            <Progress value={companyCoverage.pct} className="h-2" />
            <p className="text-xs text-muted-foreground">{companyCoverage.pct}% alias coverage</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Contacts</TabsTrigger>
          <TabsTrigger value="companies" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> Companies</TabsTrigger>
        </TabsList>

        {["contacts", "companies"].map((objectType) => (
          <TabsContent key={objectType} value={objectType} className="mt-4 space-y-4">
            {Object.keys(groupLabels).map((group) => {
              const has = getMappings(objectType).some((m) => m.group === group);
              return has ? renderMappingTable(objectType, group) : null;
            })}
          </TabsContent>
        ))}
      </Tabs>

      {/* Add Alias Dialog */}
      <Dialog open={!!addAliasDialog} onOpenChange={(open) => !open && setAddAliasDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Alias</DialogTitle>
            <DialogDescription>Add an external field name that maps to this internal field.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="e.g. first_name, firstName, given_name"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && addAliasDialog) {
                  addAlias(addAliasDialog.objectType, addAliasDialog.fieldKey, newAlias);
                }
              }}
            />
            <Button
              className="w-full"
              disabled={!newAlias.trim()}
              onClick={() => {
                if (addAliasDialog) {
                  addAlias(addAliasDialog.objectType, addAliasDialog.fieldKey, newAlias);
                  setAddAliasDialog(null);
                }
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add Alias
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
