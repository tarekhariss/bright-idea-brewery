import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { AppLayout } from "@/components/AppLayout";
import { SettingsLayout } from "@/components/SettingsLayout";

// Auth pages
import LoginPage from "./pages/Login";
// Signup removed — private platform
import ForgotPasswordPage from "./pages/ForgotPassword";
import ResetPasswordPage from "./pages/ResetPassword";

// Core pages
import DashboardPage from "./pages/Dashboard";
import ContactsPage from "./pages/Contacts";
import ContactDetailPage from "./pages/ContactDetail";
import CompaniesPage from "./pages/Companies";
import CompanyDetailPage from "./pages/CompanyDetail";
import ListsPage from "./pages/Lists";
import ListDetailPage from "./pages/ListDetail";
import ImportsPage from "./pages/Imports";
import ImportWizardPage from "./pages/ImportWizard";
import ImportJobDetailPage from "./pages/ImportJobDetail";
import SavedViewsPage from "./pages/SavedViews";
import DataHealthPage from "./pages/DataHealth";
import NotFound from "./pages/NotFound";
import WorkspaceOnboarding from "./pages/WorkspaceOnboarding";

// Search pages
import ProspectEnrichPage from "./pages/search/ProspectEnrich";
import ProspectSearchPage from "./pages/search/ProspectSearchPage";
import DataEnrichmentPage from "./pages/search/DataEnrichment";
import ProspectIntelligencePage from "./pages/search/ProspectIntelligence";

// Engage pages
import SequencesListPage from "./pages/engage/SequencesPage";
import EmailsPage from "./pages/engage/Emails";
import CallsPage from "./pages/engage/Calls";
import TasksPage from "./pages/engage/Tasks";
import CampaignsPage from "./pages/engage/CampaignsPage";
import CampaignDetailPage from "./pages/engage/CampaignDetailPage";
import EmailTemplatesPage from "./pages/engage/EmailTemplatesPage";
import InboxPage from "./pages/engage/InboxPage";
import LinkedInAccountsPage from "./pages/engage/LinkedInAccountsPage";
import UniboxPage from "./pages/engage/UniboxPage";
import EmailAccountsPage from "./pages/engage/EmailAccountsPage";
import EngageAnalyticsPage from "./pages/engage/EngageAnalyticsPage";
import { EngageLayout } from "./components/engage/EngageLayout";

// LinkedIn Outreach (standalone)
import { LinkedinLayout } from "./components/linkedin/LinkedinLayout";
import LinkedinCampaignsPage from "./pages/linkedin/LinkedinCampaignsPage";
import LinkedinCampaignDetailPage from "./pages/linkedin/LinkedinCampaignDetailPage";
import LinkedinInboxPage from "./pages/linkedin/LinkedinInboxPage";
import LinkedinTasksPage from "./pages/linkedin/LinkedinTasksPage";
import LinkedinAnalyticsPage from "./pages/linkedin/LinkedinAnalyticsPage";
import LinkedinSettingsPage from "./pages/linkedin/LinkedinSettingsPage";
import LinkedinTemplatesPage from "./pages/linkedin/LinkedinTemplatesPage";
import LinkedinSenderProfilePage from "./pages/linkedin/LinkedinSenderProfilePage";
import LinkedinActionQueuePage from "./pages/linkedin/LinkedinActionQueuePage";
import LinkedinContactsPage from "./pages/linkedin/LinkedinContactsPage";

// Deals pages
import MeetingsPage from "./pages/deals/Meetings";
import ConversationsPage from "./pages/deals/Conversations";
import DealsPage from "./pages/deals/DealsPage";

// Tools pages
import WorkflowsListPage from "./pages/tools/WorkflowsPage";
import AnalyticsPage from "./pages/tools/AnalyticsPage";
import ExportHistoryPage from "./pages/tools/ExportHistoryPage";
import BulkUpdatePage from "./pages/tools/BulkUpdatePage";
import DuplicateReviewPage from "./pages/tools/DuplicateReviewPage";
// Legacy /tools/verification → redirected to /verification

// Verification standalone module
import { VerificationLayout } from "./components/verification/VerificationLayout";

// CRM workspace (Phase 1)
import { CrmLayout } from "./components/crm/CrmLayout";
import CrmCommandCenter from "./pages/crm/CommandCenter";
import OpportunityInbox from "./pages/crm/OpportunityInbox";
import CrmPipelinePage from "./pages/crm/PipelinePage";
import OpportunitiesTable from "./pages/crm/OpportunitiesTable";
import OpportunityDetail from "./pages/crm/OpportunityDetail";
import CrmSettingsPage from "./pages/crm/CrmSettings";
import CrmComingSoon from "./pages/crm/CrmComingSoon";
import CrmAccounts from "./pages/crm/CrmAccounts";
import CrmContacts from "./pages/crm/CrmContacts";
import CrmDeals from "./pages/crm/CrmDeals";
import CrmTasks from "./pages/crm/CrmTasks";
import CrmNotes from "./pages/crm/CrmNotes";
import CrmActivity from "./pages/crm/CrmActivity";
import SmartQueues from "./pages/crm/SmartQueues";
import CrmReports from "./pages/crm/CrmReports";
import CrmReviewQueue from "./pages/crm/CrmReviewQueue";
import CrmBulkJobs from "./pages/crm/CrmBulkJobs";
import VfDashboardPage from "./pages/verification/DashboardPage";
import VfJobsPage from "./pages/verification/JobsPage";
import VfQueuePage from "./pages/verification/QueueMonitorPage";
import VfWorkersPage from "./pages/verification/WorkersPage";
import VfSuppressionPage from "./pages/verification/SuppressionPage";
import VfAIPage from "./pages/verification/AIScoringPlaceholderPage";
import VfDomainsPage from "./pages/verification/DomainIntelligencePage";
import VfProvidersPage from "./pages/verification/ProviderIntelligencePage";
import VfBouncesPage from "./pages/verification/BounceIntelligencePage";
import VfCatchAllPage from "./pages/verification/CatchAllIntelligencePage";
import VfRetryPage from "./pages/verification/RetryPipelinePage";
import VfDLQPage from "./pages/verification/DeadLetterPage";
import VfImportsPage from "./pages/verification/ImportsCenterPage";
import VfHistoricalImportsPage from "./pages/verification/HistoricalImportsPage";
import VfHistoricalImportDetailPage from "./pages/verification/HistoricalImportDetailPage";
import VfHistoryPage from "./pages/verification/HistoryExplorerPage";
import VfListQualityPage from "./pages/verification/ListQualityPage";
import VfRulesPage from "./pages/verification/RulesEnginePage";
import VfEnginesPage from "./pages/verification/EnginesRegistryPage";
import VfApiPage from "./pages/verification/ApiManagementPage";
import VfQuotasPage from "./pages/verification/QuotasPage";
import VfAuditPage from "./pages/verification/AuditLogPage";
import VfAdminPage from "./pages/verification/AdminAnalyticsPage";
import VfCampaignSafetyPage from "./pages/verification/CampaignSafetyPage";
import VfOperationsPage from "./pages/verification/OperationsDashboardPage";
import VfJobDetailPage from "./pages/verification/JobDetailPage";

// Legacy /tools/verification/:id → redirect to new detail page
function RedirectToVfJob() {
  const path = window.location.pathname.split("/").pop();
  return <Navigate to={`/verification/jobs/${path}`} replace />;
}


// Deliverability pages
import DeliverabilityOverview from "./pages/settings/deliverability/DeliverabilityOverview";
import DomainsPage from "./pages/settings/deliverability/DomainsPage";
import MailboxesPage from "./pages/settings/deliverability/MailboxesPage";
import DeliverabilityDashboard from "./pages/settings/deliverability/DeliverabilityDashboard";
import SuppressionPage from "./pages/settings/deliverability/SuppressionPage";
import SendingWindowsPage from "./pages/settings/deliverability/SendingWindowsPage";
import ESPRoutingPage from "./pages/settings/deliverability/ESPRoutingPage";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import WorkspaceDetailAdmin from "./pages/admin/WorkspaceDetailAdmin";
import SystemStatusPage from "./pages/admin/SystemStatusPage";

// Settings pages
import SettingsIndex from "./pages/settings/SettingsIndex";
import ProfileSettings from "./pages/settings/ProfileSettings";
import ProviderConnectionsPage from "./pages/settings/ProviderConnectionsPage";
// DeliverabilitySettings removed - now using dedicated pages
import {
  MailboxDomainSettings, PhoneNumberSettings, NotificationSettings,
  ChromeExtensionSettings, ConversationSettings,
  UserTeamSettings, SecuritySettings,
  PlanOverviewSettings, LicenseSettings, CreditsAISettings, AIRunSettings,
  IntegrationsSettings, ICPSettings, PersonasSettings, BuyingIntentSettings,
  WebsiteVisitorsSettings, SignalsSettings, ScoringSettings, AIContextSettings,
  RulesOfEngagementSettings, ProspectingConfigSettings, SnippetsSettings,
  TeamEmailSequencesSettings, TrackingSettings, TeamSequencesSettings,
  TeamDialerSettings, TeamConversationsSettings, RecordingSettings,
  TeamPermissionsSettings, TrackersSettings, ScorecardsSettings,
  FieldMappingsSettings, TeamMeetingsSettings, TeamSharingSettings,
  DataRequestsSettings, SystemActivityLogSettings,
  DMAnalyticsSettings, GoalsSettings, ContactFieldsSettings,
  AccountFieldsSettings, DealFieldsSettings, GlobalPicklistsSettings,
  ImportsExportsSettings,
} from "./pages/settings/SettingsPages";

const queryClient = new QueryClient();

function PL({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute><AppLayout>{children}</AppLayout></ProtectedRoute>;
}

function EL({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute><EngageLayout>{children}</EngageLayout></ProtectedRoute>;
}

function AL({ children }: { children: React.ReactNode }) {
  return <AdminRoute><AppLayout>{children}</AppLayout></AdminRoute>;
}

function LL({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute><LinkedinLayout>{children}</LinkedinLayout></ProtectedRoute>;
}

function SL({ children }: { children: React.ReactNode }) {
  return <PL><SettingsLayout>{children}</SettingsLayout></PL>;
}

function VL({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute><VerificationLayout>{children}</VerificationLayout></ProtectedRoute>;
}

function CL({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute><CrmLayout>{children}</CrmLayout></ProtectedRoute>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Auth */}
            <Route path="/login" element={<LoginPage />} />
            {/* Signup disabled — private platform */}
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/onboarding" element={<ProtectedRoute><WorkspaceOnboarding /></ProtectedRoute>} />

            {/* Dashboard */}
            <Route path="/" element={<PL><DashboardPage /></PL>} />

            {/* Search */}
            <Route path="/search" element={<PL><ProspectSearchPage /></PL>} />
            <Route path="/search/prospect" element={<PL><ProspectEnrichPage /></PL>} />
            <Route path="/search/people" element={<PL><ContactsPage /></PL>} />
            <Route path="/search/companies" element={<PL><CompaniesPage /></PL>} />
            <Route path="/search/lists" element={<PL><ListsPage /></PL>} />
            <Route path="/search/data-enrichment" element={<PL><DataEnrichmentPage /></PL>} />
            <Route path="/search/intelligence" element={<PL><ProspectIntelligencePage /></PL>} />

            {/* Engage — standalone product with its own layout */}
            <Route path="/engage" element={<EL><CampaignsPage /></EL>} />
            <Route path="/engage/campaigns" element={<EL><CampaignsPage /></EL>} />
            <Route path="/engage/campaigns/:id" element={<EL><CampaignDetailPage /></EL>} />
            <Route path="/engage/unibox" element={<EL><UniboxPage /></EL>} />
            <Route path="/engage/accounts" element={<EL><EmailAccountsPage /></EL>} />
            <Route path="/engage/templates" element={<EL><EmailTemplatesPage /></EL>} />
            <Route path="/engage/analytics" element={<EL><EngageAnalyticsPage /></EL>} />
            {/* Legacy engage routes (kept for backwards compatibility) */}
            <Route path="/engage/sequences" element={<EL><SequencesListPage /></EL>} />
            <Route path="/engage/emails" element={<EL><EmailsPage /></EL>} />
            <Route path="/engage/calls" element={<EL><CallsPage /></EL>} />
            <Route path="/engage/tasks" element={<EL><TasksPage /></EL>} />
            <Route path="/engage/inbox" element={<EL><UniboxPage /></EL>} />
            <Route path="/engage/linkedin" element={<EL><LinkedInAccountsPage /></EL>} />

            {/* LinkedIn Outreach — standalone product */}
            <Route path="/linkedin" element={<LL><LinkedinCampaignsPage /></LL>} />
            <Route path="/linkedin/campaigns" element={<LL><LinkedinCampaignsPage /></LL>} />
            <Route path="/linkedin/campaigns/:id" element={<LL><LinkedinCampaignDetailPage /></LL>} />
            <Route path="/linkedin/inbox" element={<LL><LinkedinInboxPage /></LL>} />
            <Route path="/linkedin/contacts" element={<LL><LinkedinContactsPage /></LL>} />
            <Route path="/linkedin/accounts" element={<LL><LinkedInAccountsPage /></LL>} />
            <Route path="/linkedin/accounts/:id" element={<LL><LinkedinSenderProfilePage /></LL>} />
            <Route path="/linkedin/queue" element={<LL><LinkedinActionQueuePage /></LL>} />
            <Route path="/linkedin/templates" element={<LL><LinkedinTemplatesPage /></LL>} />
            <Route path="/linkedin/tasks" element={<LL><LinkedinTasksPage /></LL>} />
            <Route path="/linkedin/analytics" element={<LL><LinkedinAnalyticsPage /></LL>} />
            <Route path="/linkedin/settings" element={<LL><LinkedinSettingsPage /></LL>} />

            {/* CRM — standalone intelligent CRM workspace (Phase 1) */}
            <Route path="/crm" element={<CL><CrmCommandCenter /></CL>} />
            <Route path="/crm/inbox" element={<CL><OpportunityInbox /></CL>} />
            <Route path="/crm/queues" element={<CL><SmartQueues /></CL>} />
            <Route path="/crm/pipeline" element={<CL><CrmPipelinePage /></CL>} />
            <Route path="/crm/opportunities" element={<CL><OpportunitiesTable /></CL>} />
            <Route path="/crm/reports" element={<CL><CrmReports /></CL>} />
            <Route path="/crm/opportunities/:id" element={<CL><OpportunityDetail /></CL>} />
            <Route path="/crm/accounts" element={<CL><CrmAccounts /></CL>} />
            <Route path="/crm/contacts" element={<CL><CrmContacts /></CL>} />
            <Route path="/crm/deals" element={<CL><CrmDeals /></CL>} />
            <Route path="/crm/tasks" element={<CL><CrmTasks /></CL>} />
            <Route path="/crm/notes" element={<CL><CrmNotes /></CL>} />
            <Route path="/crm/activity" element={<CL><CrmActivity /></CL>} />
            <Route path="/crm/settings" element={<CL><CrmSettingsPage /></CL>} />

            {/* Deals */}
            <Route path="/deals" element={<PL><MeetingsPage /></PL>} />
            <Route path="/deals/meetings" element={<PL><MeetingsPage /></PL>} />
            <Route path="/deals/conversations" element={<PL><ConversationsPage /></PL>} />
            <Route path="/deals/deals" element={<PL><DealsPage /></PL>} />


            {/* Tools */}
            <Route path="/tools" element={<PL><WorkflowsListPage /></PL>} />
            <Route path="/tools/workflows" element={<PL><WorkflowsListPage /></PL>} />
            <Route path="/tools/analytics" element={<PL><AnalyticsPage /></PL>} />
            <Route path="/tools/exports" element={<PL><ExportHistoryPage /></PL>} />
            <Route path="/tools/duplicates" element={<PL><DuplicateReviewPage /></PL>} />
            <Route path="/tools/bulk-update" element={<PL><BulkUpdatePage /></PL>} />
            <Route path="/tools/verification" element={<Navigate to="/verification" replace />} />
            <Route path="/tools/verification/:id" element={<RedirectToVfJob />} />

            {/* Verification — standalone platform */}
            <Route path="/verification" element={<VL><VfDashboardPage /></VL>} />
            <Route path="/verification/jobs" element={<VL><VfJobsPage /></VL>} />
            <Route path="/verification/jobs/:id" element={<VL><VfJobDetailPage /></VL>} />
            <Route path="/verification/queue" element={<VL><VfQueuePage /></VL>} />
            <Route path="/verification/workers" element={<VL><VfWorkersPage /></VL>} />
            <Route path="/verification/retries" element={<VL><VfRetryPage /></VL>} />
            <Route path="/verification/dead-letter" element={<VL><VfDLQPage /></VL>} />
            <Route path="/verification/domains" element={<VL><VfDomainsPage /></VL>} />
            <Route path="/verification/providers" element={<VL><VfProvidersPage /></VL>} />
            <Route path="/verification/bounces" element={<VL><VfBouncesPage /></VL>} />
            <Route path="/verification/catch-all" element={<VL><VfCatchAllPage /></VL>} />
            <Route path="/verification/imports" element={<VL><VfImportsPage /></VL>} />
            <Route path="/verification/historical-imports" element={<VL><VfHistoricalImportsPage /></VL>} />
            <Route path="/verification/historical-imports/:id" element={<VL><VfHistoricalImportDetailPage /></VL>} />
            <Route path="/verification/history" element={<VL><VfHistoryPage /></VL>} />
            <Route path="/verification/suppression" element={<VL><VfSuppressionPage /></VL>} />
            <Route path="/verification/list-quality" element={<VL><VfListQualityPage /></VL>} />
            <Route path="/verification/rules" element={<VL><VfRulesPage /></VL>} />
            <Route path="/verification/engines" element={<VL><VfEnginesPage /></VL>} />
            <Route path="/verification/api" element={<VL><VfApiPage /></VL>} />
            <Route path="/verification/quotas" element={<VL><VfQuotasPage /></VL>} />
            <Route path="/verification/audit" element={<VL><VfAuditPage /></VL>} />
            <Route path="/verification/campaign-safety" element={<VL><VfCampaignSafetyPage /></VL>} />
            <Route path="/verification/admin" element={<VL><VfAdminPage /></VL>} />
            <Route path="/verification/ai" element={<VL><VfAIPage /></VL>} />
            <Route path="/verification/operations" element={<VL><VfOperationsPage /></VL>} />


            {/* Records (reuse existing) */}
            <Route path="/records" element={<PL><ContactsPage /></PL>} />
            <Route path="/records/people" element={<PL><ContactsPage /></PL>} />
            <Route path="/records/companies" element={<PL><CompaniesPage /></PL>} />

            {/* Legacy routes (keep working) */}
            <Route path="/contacts" element={<PL><ContactsPage /></PL>} />
            <Route path="/contacts/:id" element={<PL><ContactDetailPage /></PL>} />
            <Route path="/companies" element={<PL><CompaniesPage /></PL>} />
            <Route path="/companies/:id" element={<PL><CompanyDetailPage /></PL>} />
            <Route path="/lists" element={<PL><ListsPage /></PL>} />
            <Route path="/lists/:id" element={<PL><ListDetailPage /></PL>} />
            <Route path="/imports" element={<PL><ImportsPage /></PL>} />
            <Route path="/imports/new" element={<PL><ImportWizardPage /></PL>} />
            <Route path="/imports/:id" element={<PL><ImportJobDetailPage /></PL>} />
            <Route path="/saved-views" element={<PL><SavedViewsPage /></PL>} />
            <Route path="/data-health" element={<PL><DataHealthPage /></PL>} />

            {/* Admin */}
            <Route path="/admin" element={<AL><AdminDashboard /></AL>} />
            <Route path="/admin/system-status" element={<AL><SystemStatusPage /></AL>} />
            <Route path="/admin/workspaces/:id" element={<AL><WorkspaceDetailAdmin /></AL>} />

            {/* Settings */}
            <Route path="/settings" element={<SL><SettingsIndex /></SL>} />
            <Route path="/settings/search/profile" element={<SL><ProfileSettings /></SL>} />
            <Route path="/settings/search/mailboxes-domains" element={<SL><MailboxDomainSettings /></SL>} />
            <Route path="/settings/search/phone-numbers" element={<SL><PhoneNumberSettings /></SL>} />
            <Route path="/settings/search/notifications" element={<SL><NotificationSettings /></SL>} />
            <Route path="/settings/search/chrome-extension" element={<SL><ChromeExtensionSettings /></SL>} />
            <Route path="/settings/search/conversations" element={<SL><ConversationSettings /></SL>} />

            <Route path="/settings/workspace/provider-connections" element={<SL><ProviderConnectionsPage /></SL>} />
            <Route path="/settings/workspace/deliverability" element={<SL><DeliverabilityOverview /></SL>} />
            <Route path="/settings/workspace/deliverability/overview" element={<SL><DeliverabilityOverview /></SL>} />
            <Route path="/settings/workspace/deliverability/domains" element={<SL><DomainsPage /></SL>} />
            <Route path="/settings/workspace/deliverability/mailboxes" element={<SL><MailboxesPage /></SL>} />
            <Route path="/settings/workspace/deliverability/dashboard" element={<SL><DeliverabilityDashboard /></SL>} />
            <Route path="/settings/workspace/deliverability/suppression" element={<SL><SuppressionPage /></SL>} />
            <Route path="/settings/workspace/deliverability/sending-windows" element={<SL><SendingWindowsPage /></SL>} />
            <Route path="/settings/workspace/deliverability/esp-routing" element={<SL><ESPRoutingPage /></SL>} />
            <Route path="/settings/workspace/users" element={<SL><UserTeamSettings /></SL>} />
            <Route path="/settings/workspace/security" element={<SL><SecuritySettings /></SL>} />

            <Route path="/settings/billing/plan-overview" element={<SL><PlanOverviewSettings /></SL>} />
            <Route path="/settings/billing/license-settings" element={<SL><LicenseSettings /></SL>} />
            <Route path="/settings/billing/credits-ai-usage" element={<SL><CreditsAISettings /></SL>} />
            <Route path="/settings/billing/ai-run-usage" element={<SL><AIRunSettings /></SL>} />

            <Route path="/settings/integrations" element={<SL><IntegrationsSettings /></SL>} />
            <Route path="/settings/integrations/icp" element={<SL><ICPSettings /></SL>} />
            <Route path="/settings/integrations/personas" element={<SL><PersonasSettings /></SL>} />
            <Route path="/settings/integrations/buying-intent" element={<SL><BuyingIntentSettings /></SL>} />
            <Route path="/settings/integrations/website-visitors" element={<SL><WebsiteVisitorsSettings /></SL>} />
            <Route path="/settings/integrations/signals" element={<SL><SignalsSettings /></SL>} />
            <Route path="/settings/integrations/scoring" element={<SL><ScoringSettings /></SL>} />
            <Route path="/settings/integrations/ai-context" element={<SL><AIContextSettings /></SL>} />
            <Route path="/settings/integrations/rules-of-engagement" element={<SL><RulesOfEngagementSettings /></SL>} />
            <Route path="/settings/integrations/prospecting-config" element={<SL><ProspectingConfigSettings /></SL>} />
            <Route path="/settings/integrations/snippets" element={<SL><SnippetsSettings /></SL>} />

            <Route path="/settings/team/email-sequences" element={<SL><TeamEmailSequencesSettings /></SL>} />
            <Route path="/settings/team/tracking" element={<SL><TrackingSettings /></SL>} />
            <Route path="/settings/team/sequences" element={<SL><TeamSequencesSettings /></SL>} />
            <Route path="/settings/team/dialer" element={<SL><TeamDialerSettings /></SL>} />
            <Route path="/settings/team/conversations" element={<SL><TeamConversationsSettings /></SL>} />
            <Route path="/settings/team/recording" element={<SL><RecordingSettings /></SL>} />
            <Route path="/settings/team/permissions" element={<SL><TeamPermissionsSettings /></SL>} />
            <Route path="/settings/team/trackers" element={<SL><TrackersSettings /></SL>} />
            <Route path="/settings/team/scorecards" element={<SL><ScorecardsSettings /></SL>} />
            <Route path="/settings/team/field-mappings" element={<SL><FieldMappingsSettings /></SL>} />
            <Route path="/settings/team/meetings" element={<SL><TeamMeetingsSettings /></SL>} />
            <Route path="/settings/team/sharing-defaults" element={<SL><TeamSharingSettings /></SL>} />

            <Route path="/settings/system-activity/data-requests" element={<SL><DataRequestsSettings /></SL>} />
            <Route path="/settings/system-activity/log" element={<SL><SystemActivityLogSettings /></SL>} />

            <Route path="/settings/data-management/analytics" element={<SL><DMAnalyticsSettings /></SL>} />
            <Route path="/settings/data-management/goals" element={<SL><GoalsSettings /></SL>} />
            <Route path="/settings/data-management/contact-fields-stages" element={<SL><ContactFieldsSettings /></SL>} />
            <Route path="/settings/data-management/account-fields-stages" element={<SL><AccountFieldsSettings /></SL>} />
            <Route path="/settings/data-management/deal-fields-stages" element={<SL><DealFieldsSettings /></SL>} />
            <Route path="/settings/data-management/global-picklists" element={<SL><GlobalPicklistsSettings /></SL>} />
            <Route path="/settings/data-management/imports-exports" element={<SL><ImportsExportsSettings /></SL>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
