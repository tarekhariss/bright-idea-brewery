/**
 * Export Engine hooks — manage export jobs and templates.
 * Large exports use the run-export-job edge function for server-side processing.
 */
import { useState, useCallback, useEffect } from "react";
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
  const { workspaceId } = useAuth();
  const queryClient = useQueryClient();

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["export-jobs", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("export_jobs") as any)
        .select("*")
        .eq("workspace_id", workspaceId)
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
  const { workspaceId } = useAuth();
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["export-templates", entityType, workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("export_templates") as any)
        .select("*")
        .eq("entity_type", entityType)
        .eq("workspace_id", workspaceId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ExportTemplate[];
    },
  });

  const saveTemplate = useCallback(async (name: string, columns: string[], wsId: string) => {
    const { error } = await (supabase.from("export_templates") as any).insert({
      workspace_id: wsId,
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

// ─── Create Export Job (server-side via edge function) ─────────────────────────

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

const SERVER_SIDE_THRESHOLD = 500;

export function useCreateExport() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Poll for active job status
  useEffect(() => {
    if (!activeJobId) return;
    const interval = setInterval(async () => {
      const { data } = await (supabase.from("export_jobs") as any)
        .select("status, processed_rows, total_rows, file_url, error_message")
        .eq("id", activeJobId)
        .single();
      if (!data) return;
      if (data.status === "completed") {
        clearInterval(interval);
        setActiveJobId(null);
        setCreating(false);
        queryClient.invalidateQueries({ queryKey: ["export-jobs"] });
        if (data.file_url) {
          window.open(data.file_url, "_blank");
          toast.success(`Export completed — ${data.processed_rows} rows`);
        } else {
          toast.success(`Export completed — ${data.processed_rows} rows (no download URL)`);
        }
      } else if (data.status === "failed") {
        clearInterval(interval);
        setActiveJobId(null);
        setCreating(false);
        queryClient.invalidateQueries({ queryKey: ["export-jobs"] });
        toast.error(`Export failed: ${data.error_message || "Unknown error"}`);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeJobId, queryClient]);

  const createExport = useCallback(async (params: CreateExportParams) => {
    if (!user) return null;
    setCreating(true);
    try {
      // Count rows to decide client vs server
      let totalRows = 0;
      if (params.exportType === "selected" && params.selectedIds) {
        totalRows = params.selectedIds.length;
      } else {
        let countQuery = (supabase.from(params.entityType === "contact" ? "contacts" : "companies") as any)
          .select("id", { count: "exact", head: true });
        if (params.workspaceId) countQuery = countQuery.eq("workspace_id", params.workspaceId);
        const { count } = await countQuery;
        totalRows = count ?? 0;
      }

      // Create job record
      const { data: job, error } = await (supabase.from("export_jobs") as any)
        .insert({
          workspace_id: params.workspaceId,
          entity_type: params.entityType,
          export_type: params.exportType,
          status: "pending",
          total_rows: totalRows,
          file_name: params.fileName,
          selected_columns: params.selectedColumns,
          filter_definition: params.filterDefinition ?? null,
          selected_ids: params.selectedIds ?? null,
          template_id: params.templateId ?? null,
          source_id: params.sourceId ?? null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Server-side for large exports
      if (totalRows > SERVER_SIDE_THRESHOLD) {
        const { data: { session } } = await supabase.auth.getSession();
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const res = await fetch(`${supabaseUrl}/functions/v1/run-export-job`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ job_id: job.id }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Export job failed to start");
        }
        setActiveJobId(job.id);
        toast.info(`Export started — processing ${totalRows.toLocaleString()} rows server-side…`);
        return job;
      }

      // Client-side for small exports
      await (supabase.from("export_jobs") as any).update({ status: "processing", started_at: new Date().toISOString() }).eq("id", job.id);

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

      const csvRows = [params.selectedColumns.join(",")];
      for (const row of (rows ?? [])) {
        const vals = params.selectedColumns.map((col) => {
          const v = row[col];
          if (v === null || v === undefined) return "";
          const str = Array.isArray(v) ? v.join("; ") : String(v);
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"` : str;
        });
        csvRows.push(vals.join(","));
      }

      const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = params.fileName;
      a.click();
      URL.revokeObjectURL(url);

      await (supabase.from("export_jobs") as any).update({
        status: "completed",
        processed_rows: (rows ?? []).length,
        total_rows: (rows ?? []).length,
        completed_at: new Date().toISOString(),
      }).eq("id", job.id);

      queryClient.invalidateQueries({ queryKey: ["export-jobs"] });
      toast.success(`Exported ${(rows ?? []).length} ${params.entityType}(s)`);
      return job;
    } catch (err: any) {
      console.error(err);
      toast.error("Export failed: " + (err.message || "Unknown error"));
      return null;
    } finally {
      if (!activeJobId) setCreating(false);
    }
  }, [user, queryClient, activeJobId]);

  return { createExport, creating };
}
