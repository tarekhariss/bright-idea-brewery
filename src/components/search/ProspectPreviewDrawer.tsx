/**
 * ProspectPreviewDrawer — Side panel showing quick contact/company details.
 */
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Mail, Phone, Linkedin, MapPin, Building2, Briefcase, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { EntityType } from "@/hooks/use-prospect-search";

interface ProspectPreviewDrawerProps {
  open: boolean;
  onClose: () => void;
  entityType: EntityType;
  record: any;
}

export function ProspectPreviewDrawer({ open, onClose, entityType, record }: ProspectPreviewDrawerProps) {
  const navigate = useNavigate();
  if (!record) return null;

  const isContact = entityType === "contact";
  const detailPath = isContact ? `/contacts/${record.id}` : `/companies/${record.id}`;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[400px] sm:w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">
            {isContact
              ? `${record.first_name || ""} ${record.last_name || ""}`.trim() || "Unnamed"
              : record.name || "Unnamed"}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Status badges */}
          <div className="flex flex-wrap gap-1.5">
            {isContact && record.lifecycle_status && (
              <Badge variant="outline" className="text-[10px]">{record.lifecycle_status}</Badge>
            )}
            {isContact && record.outreach_status && (
              <Badge variant="secondary" className="text-[10px]">{record.outreach_status}</Badge>
            )}
            {isContact && record.email_validity_status && (
              <Badge variant={record.email_validity_status === "valid" ? "default" : "outline"} className="text-[10px]">
                Email: {record.email_validity_status}
              </Badge>
            )}
            {isContact && record.phone_status && (
              <Badge variant="outline" className="text-[10px]">Phone: {record.phone_status}</Badge>
            )}
          </div>

          {/* Key fields */}
          <div className="space-y-2 text-sm">
            {isContact && record.job_title && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="h-3.5 w-3.5 shrink-0" />
                <span>{record.job_title}</span>
                {record.seniority_level && <span className="text-muted-foreground/60">· {record.seniority_level}</span>}
              </div>
            )}
            {isContact && record.company_name_raw && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span>{record.company_name_raw}</span>
              </div>
            )}
            {!isContact && record.industry && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span>{record.industry}</span>
              </div>
            )}
            {(record.email || record.domain) && (
              <div className="flex items-center gap-2 text-muted-foreground">
                {isContact ? <Mail className="h-3.5 w-3.5 shrink-0" /> : <Globe className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{isContact ? record.email : record.domain}</span>
              </div>
            )}
            {isContact && record.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>{record.phone}</span>
              </div>
            )}
            {record.linkedin_url && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Linkedin className="h-3.5 w-3.5 shrink-0" />
                <a href={record.linkedin_url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate text-xs">
                  LinkedIn Profile
                </a>
              </div>
            )}
            {(record.city || record.state || record.country) && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>{[record.city, record.state, record.country].filter(Boolean).join(", ")}</span>
              </div>
            )}
          </div>

          {/* Company-specific fields */}
          {!isContact && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-3 text-sm">
                {record.employee_count != null && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Employees</div>
                    <div className="font-medium">{record.employee_count.toLocaleString()}</div>
                  </div>
                )}
                {record.revenue_range && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Revenue</div>
                    <div className="font-medium">{record.revenue_range}</div>
                  </div>
                )}
                {record.funding_stage && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Funding</div>
                    <div className="font-medium">{record.funding_stage}</div>
                  </div>
                )}
                {record.total_funding != null && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Total Raised</div>
                    <div className="font-medium">${(record.total_funding / 1_000_000).toFixed(1)}M</div>
                  </div>
                )}
              </div>
              {record.technologies?.length > 0 && (
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase mb-1">Technologies</div>
                  <div className="flex flex-wrap gap-1">
                    {record.technologies.slice(0, 10).map((t: string) => (
                      <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                    ))}
                    {record.technologies.length > 10 && (
                      <Badge variant="outline" className="text-[10px]">+{record.technologies.length - 10}</Badge>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <Separator />

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            {record.source && (
              <div>
                <span className="font-medium">Source:</span> {record.source}
              </div>
            )}
            {record.data_quality_score != null && (
              <div>
                <span className="font-medium">Quality:</span> {record.data_quality_score}/100
              </div>
            )}
            <div>
              <span className="font-medium">Created:</span>{" "}
              {record.created_at ? new Date(record.created_at).toLocaleDateString() : "—"}
            </div>
            <div>
              <span className="font-medium">Updated:</span>{" "}
              {record.updated_at ? new Date(record.updated_at).toLocaleDateString() : "—"}
            </div>
          </div>

          <Separator />

          <Button className="w-full" size="sm" onClick={() => { onClose(); navigate(detailPath); }}>
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Open Full Detail
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
