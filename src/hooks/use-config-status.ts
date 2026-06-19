/**
 * useConfigStatus — single source of truth for "is this capability configured?".
 *
 * Replaces every fake-success path in the app with a real read of provider state
 * from the database. Each capability returns { ready, reason, fix } so UI can
 * disable buttons, show banners, or open ConfigRequiredModal.
 *
 * Capabilities tracked:
 *   - email      : at least one connected mailbox (SMTP or OAuth) in the workspace
 *   - linkedin   : at least one active LinkedIn account in the workspace
 *   - domains    : at least one verified sending domain
 *   - tracking   : at least one mailbox with tracking_cname_verified
 *   - oauthGoogle/oauthOutlook: provider_connections row for that type, active
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";

export type CapabilityKey =
  | "email"
  | "linkedin"
  | "domains"
  | "tracking"
  | "oauthGoogle"
  | "oauthOutlook";

export interface CapabilityStatus {
  ready: boolean;
  count: number;
  reason: string;
  /** Route to the settings/onboarding page that resolves the missing config. */
  fixHref: string;
  fixLabel: string;
}

export interface ConfigStatus {
  loading: boolean;
  email: CapabilityStatus;
  linkedin: CapabilityStatus;
  domains: CapabilityStatus;
  tracking: CapabilityStatus;
  oauthGoogle: CapabilityStatus;
  oauthOutlook: CapabilityStatus;
}

const NOT_READY = (reason: string, fixHref: string, fixLabel: string): CapabilityStatus => ({
  ready: false,
  count: 0,
  reason,
  fixHref,
  fixLabel,
});

const READY = (count: number): CapabilityStatus => ({
  ready: true,
  count,
  reason: "",
  fixHref: "",
  fixLabel: "",
});

export function useConfigStatus(): ConfigStatus {
  const { workspaceId } = useWorkspace();

  const { data, isLoading } = useQuery({
    queryKey: ["config-status", workspaceId],
    enabled: !!workspaceId,
    staleTime: 30_000,
    queryFn: async () => {
      const [mailboxes, linkedinAccounts, domains, providerConns] = await Promise.all([
        supabase
          .from("mailboxes")
          .select("id, connection_status, tracking_cname_verified", { count: "exact" })
          .eq("workspace_id", workspaceId!),
        supabase
          .from("linkedin_accounts")
          .select("id, connection_status, active", { count: "exact" })
          .eq("workspace_id", workspaceId!),
        supabase
          .from("sending_domains")
          .select("id, status", { count: "exact" })
          .eq("workspace_id", workspaceId!),
        supabase
          .from("provider_connections")
          .select("id, provider_type, connection_status")
          .eq("workspace_id", workspaceId!),
      ]);

      return {
        mailboxes: mailboxes.data ?? [],
        linkedinAccounts: linkedinAccounts.data ?? [],
        domains: domains.data ?? [],
        providerConns: providerConns.data ?? [],
      };
    },
  });

  const mailboxes = data?.mailboxes ?? [];
  const linkedinAccounts = data?.linkedinAccounts ?? [];
  const domains = data?.domains ?? [];
  const providerConns = data?.providerConns ?? [];

  const connectedMailboxes = mailboxes.filter((m: any) => m.connection_status === "connected");
  const activeLinkedin = linkedinAccounts.filter(
    (a: any) => a.active && a.connection_status === "connected",
  );
  const verifiedDomains = domains.filter((d: any) => d.status === "verified" || d.status === "active");
  const verifiedTracking = mailboxes.filter((m: any) => m.tracking_cname_verified);
  const googleProvider = providerConns.find(
    (p: any) => p.provider_type === "google" && p.connection_status === "active",
  );
  const outlookProvider = providerConns.find(
    (p: any) => p.provider_type === "outlook" && p.connection_status === "active",
  );

  return {
    loading: isLoading,
    email: connectedMailboxes.length
      ? READY(connectedMailboxes.length)
      : NOT_READY(
          "No connected mailbox. Connect at least one SMTP or OAuth inbox to send email.",
          "/engage/email-accounts",
          "Connect mailbox",
        ),
    linkedin: activeLinkedin.length
      ? READY(activeLinkedin.length)
      : NOT_READY(
          "No active LinkedIn account. Connect a LinkedIn account to run LinkedIn campaigns.",
          "/engage/linkedin-accounts",
          "Connect LinkedIn",
        ),
    domains: verifiedDomains.length
      ? READY(verifiedDomains.length)
      : NOT_READY(
          "No verified sending domain. Add a domain and verify SPF / DKIM / DMARC DNS records.",
          "/settings/deliverability/domains",
          "Configure domain",
        ),
    tracking: verifiedTracking.length
      ? READY(verifiedTracking.length)
      : NOT_READY(
          "Click / open tracking domain is not verified. Add the CNAME for your tracking subdomain.",
          "/settings/deliverability/domains",
          "Configure tracking",
        ),
    oauthGoogle: googleProvider
      ? READY(1)
      : NOT_READY(
          "Google OAuth provider not connected. Sign in with Google to enable Gmail sending.",
          "/settings/provider-connections",
          "Connect Google",
        ),
    oauthOutlook: outlookProvider
      ? READY(1)
      : NOT_READY(
          "Outlook OAuth provider not connected. Sign in with Microsoft to enable Outlook sending.",
          "/settings/provider-connections",
          "Connect Outlook",
        ),
  };
}

/** Check several capabilities at once. Returns the first not-ready, or null. */
export function firstMissing(status: ConfigStatus, keys: CapabilityKey[]): CapabilityStatus | null {
  for (const k of keys) {
    const cap = status[k];
    if (!cap.ready) return cap;
  }
  return null;
}
