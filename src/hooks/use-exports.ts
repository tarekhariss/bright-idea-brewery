/**
 * Export Engine hooks — manage export jobs and templates.
 */
import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { FilterDefinition } from "@/lib/advanced-filter-types";

export interface ExportJob {
  id: string;
  workspace_id: string;
  entity_type: "contact" | "company";
  export_type: string;
  status: string;
  total_rows: number;
  processed_rows: number;
  file_url: string | null;
  file_name: string;
  filter_definition: any;
  selected_ids: string[] | null;
  selected_columns: string[];
  template_id: string | null;
  source_id: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ExportTemplate {
  id: string;
  workspace_id: string;
  name: string;
  entity_type: "contact" | "company";
  columns: string[];
  is_default: boolean;
  created_by: string | null;
  created_at: string;
}

// ─── Default export columns ────────────────────────────────────────────────────

export const DEFAULT_CONTACT_EXPORT_COLUMNS = [
  "first_name", "last_name", "email", "secondary_email", "job_title",
  "seniority_level", "department", "linkedin_url", "phone", "mobile_phone",
  "company_name_raw", "country", "city", "state", "industry",
];

export const DEFAULT_COMPANY_EXPORT_COLUMNS = [
  "name", "domain", "industry", "employee_count", "employee_range",
  "revenue_range", "country", "city", "website", "linkedin_url",
  "annual_revenue", "technologies", "funding_stage",
];

export const ALL_CONTACT_EXPORT_COLUMNS = [
  "first_name", "last_name", "email", "secondary_email", "tertiary_email", "personal_email",
  "job_title", "seniority_level", "department", "headline", "bio", "persona",
  "linkedin_url", "twitter_url", "facebook_url", "github_url", "photo_url",
  "phone", "work_direct_phone", "mobile_phone", "corporate_phone", "home_phone", "other_phone",
  "country", "city", "state", "address", "postal_code", "timezone",
  "company_name_raw", "lifecycle_status", "outreach_status", "email_validity_status",
  "years_experience", "skills", "languages", "source", "import_tag",
  "data_quality_score", "owner_id", "created_at",
];

export const ALL_COMPANY_EXPORT_COLUMNS = [
  "name", "domain", "website", "industry", "employee_count", "employee_range",
  "revenue_range", "annual_revenue", "total_funding", "latest_funding", "latest_funding_amount",
  "funding_stage", "founded_year", "company_type", "headquarters",
  "country", "city", "state", "linkedin_url", "facebook_url", "twitter_url",
  "technologies", "keywords", "specialties", "market_segments", "territories",
  "sic_code", "naics_code", "stock_ticker", "headcount_growth_pct",
  "data_quality_score", "owner_id", "created_at",
];

// ─── Export Jobs Hook ──────────────────────────────────────────────────────────

export function useExportJobs() {
  const queryClient = useQueryClient();

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["export-jobs"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("export_jobs") as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as ExportJob[];
    },
  });

  return { jobs, isLoading, refetch: () => queryClient.invalidateQueries({ queryKey: ["export-jobs"] }) };
}

// ─── Export Templates Hook ─────────────────────────────────────────────────────

export function useExportTemplates(entityType: "contact" | "company") {
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["export-templates", entityType],
    queryFn: async () => {
      const { data, error } = await (supabase.from("export_templates") as any)
        .select("*")
        .eq("entity_type", entityType)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ExportTemplate[];
    },
  });

  const saveTemplate = useCallback(async (name: string, columns: string[], workspaceId: string) => {
    const { error } = await (supabase.from("export_templates") as any).insert({
      workspace_id: workspaceId,
      name,
      entity_type: entityType,
      columns,
      created_by: (await supabase.auth.getUser()).data.user?.id,
    });
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["export-templates"] });
    toast.success(`Template "${name}" saved`);
  }, [entityType, queryClient]);

  const deleteTemplate = useCallback(async (id: string) => {
    const { error } = await (supabase.from("export_templates") as any).delete().eq("id", id);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["export-templates"] });
  }, [queryClient]);

  return { templates, isLoading, saveTemplate, deleteTemplate };
}

// ─── Create Export Job ─────────────────────────────────────────────────────────

export interface CreateExportParams {
  workspaceId: string;
  entityType: "contact" | "company";
  exportType: "filtered" | "selected" | "list" | "saved_search" | "full";
  fileName: string;
  selectedColumns: string[];
  filterDefinition?: FilterDefinition | null;
  selectedIds?: string[];
  templateId?: string;
  sourceId?: string;
}

export function useCreateExport() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);

  const createExport = useCallback(async (params: CreateExportParams) => {
    if (!user) return null;
    setCreating(true);
    try {
      // Count rows based on export type
      let totalRows = 0;
      if (params.exportType === "selected" && params.selectedIds) {
        totalRows = params.selectedIds.length;
      } else {
        // Estimate from query
        let countQuery = (supabase.from(params.entityType === "contact" ? "contacts" : "companies") as any)
          .select("id", { count: "exact", head: true });
        if (params.workspaceId) countQuery = countQuery.eq("workspace_id", params.workspaceId);
        const { count } = await countQuery;
        totalRows = count ?? 0;
      }

      const { data: job, error } = await (supabase.from("export_jobs") as any)
        .insert({
          workspace_id: params.workspaceId,
          entity_type: params.entityType,
          export_type: params.exportType,
          status: "processing",
          total_rows: totalRows,
          file_name: params.fileName,
          selected_columns: params.selectedColumns,
          filter_definition: params.filterDefinition ?? null,
          selected_ids: params.selectedIds ?? null,
          template_id: params.templateId ?? null,
          source_id: params.sourceId ?? null,
          started_at: new Date().toISOString(),
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Generate CSV in-browser
      const table = params.entityType === "contact" ? "contacts" : "companies";
      let dataQuery = (supabase.from(table) as any)
        .select(params.selectedColumns.join(","))
        .limit(100000);

      if (params.workspaceId) dataQuery = dataQuery.eq("workspace_id", params.workspaceId);
      if (params.exportType === "selected" && params.selectedIds?.length) {
        dataQuery = dataQuery.in("id", params.selectedIds);
      }

      const { data: rows, error: fetchErr } = await dataQuery;
      if (fetchErr) throw fetchErr;

      // Build CSV
      const csvRows = [params.selectedColumns.join(",")];
      for (const row of (rows ?? [])) {
        const vals = params.selectedColumns.map((col) => {
          const v = row[col];
          if (v === null || v === undefined) return "";
          const str = Array.isArray(v) ? v.join("; ") : String(v);
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        });
        csvRows.push(vals.join(","));
      }

      const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);

      // Trigger download
      const a = document.createElement("a");
      a.href = url;
      a.download = params.fileName;
      a.click();
      URL.revokeObjectURL(url);

      // Update job as completed
      await (supabase.from("export_jobs") as any)
        .update({
          status: "completed",
          processed_rows: (rows ?? []).length,
          total_rows: (rows ?? []).length,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      queryClient.invalidateQueries({ queryKey: ["export-jobs"] });
      toast.success(`Exported ${(rows ?? []).length} ${params.entityType}(s)`);
      return job;
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
      return null;
    } finally {
      setCreating(false);
    }
  }, [user, queryClient]);

  return { createExport, creating };
}
