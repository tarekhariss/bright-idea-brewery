import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useWorkspaceKpis() {
  return useQuery({
    queryKey: ["workspace-kpis"],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_kpis")
        .select("*")
        .order("period_end", { ascending: false })
        .limit(12);
      return data || [];
    },
  });
}

export function useCampaignPerformance(campaignId: string | null) {
  return useQuery({
    queryKey: ["campaign-performance", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_performance_metrics")
        .select("*")
        .eq("campaign_id", campaignId!)
        .maybeSingle();
      return data;
    },
  });
}

export function useCampaignAttribution(campaignId: string | null) {
  return useQuery({
    queryKey: ["campaign-attribution", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_attribution")
        .select("*")
        .eq("campaign_id", campaignId!);
      return data || [];
    },
  });
}

export function useContactAttribution(contactId: string | null) {
  return useQuery({
    queryKey: ["contact-attribution", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_attribution")
        .select("*, campaigns(name)")
        .eq("contact_id", contactId!);
      return data || [];
    },
  });
}

export function useCompanyAttribution(companyId: string | null) {
  return useQuery({
    queryKey: ["company-attribution", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_attribution")
        .select("*, campaigns(name)")
        .eq("company_id", companyId!);
      return data || [];
    },
  });
}

export function useContactFunnel(contactId: string | null) {
  return useQuery({
    queryKey: ["contact-funnel", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data } = await supabase
        .from("contact_funnel_metrics")
        .select("*")
        .eq("contact_id", contactId!);
      return data || [];
    },
  });
}

export function useAllCampaignPerformance() {
  return useQuery({
    queryKey: ["all-campaign-performance"],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_performance_metrics")
        .select("*, campaigns(name)")
        .order("updated_at", { ascending: false });
      return data || [];
    },
  });
}

export function useAnalyticsOverview() {
  return useQuery({
    queryKey: ["analytics-unified-overview"],
    queryFn: async () => {
      const [
        contactsRes, companiesRes, dealsRes, campaignsRes,
        emailsRes, meetingsRes, attributionRes,
      ] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("deals").select("id,amount,status").limit(50000),
        supabase.from("campaigns").select("id,status").limit(50000),
        supabase.from("emails").select("id,status,sent_at").limit(50000),
        supabase.from("meetings").select("id,status").limit(50000),
        supabase.from("campaign_attribution").select("attributed_revenue").limit(50000),
      ]);

      const deals = dealsRes.data || [];
      const campaigns = campaignsRes.data || [];
      const emails = emailsRes.data || [];
      const meetings = meetingsRes.data || [];
      const attributions = attributionRes.data || [];

      const sentEmails = emails.filter(e => e.status === "sent" || e.status === "sent_mock");
      const activeCampaigns = campaigns.filter(c => c.status === "active");
      const wonDeals = deals.filter(d => d.status === "won");
      const totalRevenue = wonDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
      const attributedRevenue = attributions.reduce((sum, a) => sum + (Number(a.attributed_revenue) || 0), 0);
      const completedMeetings = meetings.filter(m => m.status === "completed" || m.status === "scheduled");

      return {
        totalContacts: contactsRes.count || 0,
        totalCompanies: companiesRes.count || 0,
        emailsSent: sentEmails.length,
        activeCampaigns: activeCampaigns.length,
        totalDeals: deals.length,
        wonDeals: wonDeals.length,
        totalRevenue,
        attributedRevenue,
        meetingsBooked: completedMeetings.length,
        totalMeetings: meetings.length,
      };
    },
    staleTime: 60_000,
  });
}
