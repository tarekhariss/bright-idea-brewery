import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { SettingsLayout } from "@/components/SettingsLayout";

// Auth pages
import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";
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

// Search pages
import ProspectEnrichPage from "./pages/search/ProspectEnrich";
import DataEnrichmentPage from "./pages/search/DataEnrichment";

// Engage pages
import SequencesListPage from "./pages/engage/SequencesPage";
import EmailsPage from "./pages/engage/Emails";
import CallsPage from "./pages/engage/Calls";
import TasksPage from "./pages/engage/Tasks";
import CampaignsPage from "./pages/engage/CampaignsPage";
import CampaignDetailPage from "./pages/engage/CampaignDetailPage";
import EmailTemplatesPage from "./pages/engage/EmailTemplatesPage";
import InboxPage from "./pages/engage/InboxPage";

// Deals pages
import MeetingsPage from "./pages/deals/Meetings";
import ConversationsPage from "./pages/deals/Conversations";
import DealsPage from "./pages/deals/DealsPage";

// Tools pages
import WorkflowsListPage from "./pages/tools/WorkflowsPage";
import AnalyticsPage from "./pages/tools/AnalyticsPage";

// Deliverability pages
import DeliverabilityOverview from "./pages/settings/deliverability/DeliverabilityOverview";
import DomainsPage from "./pages/settings/deliverability/DomainsPage";
import MailboxesPage from "./pages/settings/deliverability/MailboxesPage";
import DeliverabilityDashboard from "./pages/settings/deliverability/DeliverabilityDashboard";
import SuppressionPage from "./pages/settings/deliverability/SuppressionPage";
import SendingWindowsPage from "./pages/settings/deliverability/SendingWindowsPage";
import ESPRoutingPage from "./pages/settings/deliverability/ESPRoutingPage";

// Settings pages
import SettingsIndex from "./pages/settings/SettingsIndex";
import ProfileSettings from "./pages/settings/ProfileSettings";
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

function SL({ children }: { children: React.ReactNode }) {
  return <PL><SettingsLayout>{children}</SettingsLayout></PL>;
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
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Dashboard */}
            <Route path="/" element={<PL><DashboardPage /></PL>} />

            {/* Search */}
            <Route path="/search" element={<PL><ProspectEnrichPage /></PL>} />
            <Route path="/search/people" element={<PL><ContactsPage /></PL>} />
            <Route path="/search/companies" element={<PL><CompaniesPage /></PL>} />
            <Route path="/search/lists" element={<PL><ListsPage /></PL>} />
            <Route path="/search/data-enrichment" element={<PL><DataEnrichmentPage /></PL>} />

            {/* Engage */}
            <Route path="/engage" element={<PL><SequencesListPage /></PL>} />
            <Route path="/engage/sequences" element={<PL><SequencesListPage /></PL>} />
            <Route path="/engage/emails" element={<PL><EmailsPage /></PL>} />
            <Route path="/engage/calls" element={<PL><CallsPage /></PL>} />
            <Route path="/engage/tasks" element={<PL><TasksPage /></PL>} />
            <Route path="/engage/campaigns" element={<PL><CampaignsPage /></PL>} />
            <Route path="/engage/campaigns/:id" element={<PL><CampaignDetailPage /></PL>} />
            <Route path="/engage/templates" element={<PL><EmailTemplatesPage /></PL>} />
            <Route path="/engage/inbox" element={<PL><InboxPage /></PL>} />

            {/* Deals */}
            <Route path="/deals" element={<PL><MeetingsPage /></PL>} />
            <Route path="/deals/meetings" element={<PL><MeetingsPage /></PL>} />
            <Route path="/deals/conversations" element={<PL><ConversationsPage /></PL>} />
            <Route path="/deals/deals" element={<PL><DealsPage /></PL>} />

            {/* Tools */}
            <Route path="/tools" element={<PL><WorkflowsListPage /></PL>} />
            <Route path="/tools/workflows" element={<PL><WorkflowsListPage /></PL>} />
            <Route path="/tools/analytics" element={<PL><AnalyticsPage /></PL>} />

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

            {/* Settings */}
            <Route path="/settings" element={<SL><SettingsIndex /></SL>} />
            <Route path="/settings/search/profile" element={<SL><ProfileSettings /></SL>} />
            <Route path="/settings/search/mailboxes-domains" element={<SL><MailboxDomainSettings /></SL>} />
            <Route path="/settings/search/phone-numbers" element={<SL><PhoneNumberSettings /></SL>} />
            <Route path="/settings/search/notifications" element={<SL><NotificationSettings /></SL>} />
            <Route path="/settings/search/chrome-extension" element={<SL><ChromeExtensionSettings /></SL>} />
            <Route path="/settings/search/conversations" element={<SL><ConversationSettings /></SL>} />

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
