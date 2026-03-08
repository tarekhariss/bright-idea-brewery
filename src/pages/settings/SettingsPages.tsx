import { LucideIcon } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import CustomFieldsManager from "@/components/settings/CustomFieldsManager";
import PipelineStagesManager from "@/components/settings/PipelineStagesManager";
import GlobalPicklistsManager from "@/components/settings/GlobalPicklistsManager";
import GoalsManager from "@/components/settings/GoalsManager";
import SystemActivityLogViewer from "@/components/settings/SystemActivityLogViewer";
import {
  Mail, Phone, Bell, Chrome, MessageSquare,
  Users, Shield, CreditCard, Lock, Zap, Brain, Puzzle,
  Target, UserCheck, Eye, Globe2, Signal, Star,
  Scale, Crosshair, FileText, GitBranch, PhoneCall,
  Video, ListChecks, ClipboardList, Map, CalendarDays, Share2,
  Download, ActivityIcon, BarChart3, Flag, Layers,
  Activity,
} from "lucide-react";

interface GenericSettingsProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

function GenericSettings({ icon, title, description }: GenericSettingsProps) {
  return (
    <PageShell
      icon={icon}
      title={title}
      description={description}
      emptyState={{
        icon,
        title: `${title} configuration`,
        description: `This section will allow you to manage ${title.toLowerCase()} settings. Configuration options are being built for your platform.`,
      }}
    />
  );
}

// Personal Settings
export function MailboxDomainSettings() {
  return <GenericSettings icon={Mail} title="Mailboxes & Domains" description="Manage connected mailboxes and authenticated sending domains." />;
}
export function PhoneNumberSettings() {
  return <GenericSettings icon={Phone} title="Phone Numbers" description="Configure phone numbers for outbound calling and caller ID." />;
}
export function NotificationSettings() {
  return <GenericSettings icon={Bell} title="Notifications" description="Control how and when you receive platform notifications." />;
}
export function ChromeExtensionSettings() {
  return <GenericSettings icon={Chrome} title="Chrome Extension" description="Set up the TLBG Chrome extension for LinkedIn and web prospecting." />;
}
export function ConversationSettings() {
  return <GenericSettings icon={MessageSquare} title="Conversations" description="Configure conversation threading, auto-replies, and routing rules." />;
}

// Workspace
export function UserTeamSettings() {
  return <GenericSettings icon={Users} title="Users & Teams" description="Manage team members, roles, and team structure." />;
}
export function SecuritySettings() {
  return <GenericSettings icon={Shield} title="Security" description="Configure security policies, SSO, and access controls." />;
}

// Billing
export function PlanOverviewSettings() {
  return <GenericSettings icon={CreditCard} title="Plan Overview" description="View your current plan, usage, and billing details." />;
}
export function LicenseSettings() {
  return <GenericSettings icon={Lock} title="License Settings" description="Manage seat licenses and feature access across your organization." />;
}
export function CreditsAISettings() {
  return <GenericSettings icon={Zap} title="Credits & AI Usage" description="Track AI credit consumption and enrichment usage." />;
}
export function AIRunSettings() {
  return <GenericSettings icon={Brain} title="AI Run Usage" description="Monitor AI automation runs, triggers, and processing logs." />;
}

// Integrations
export function IntegrationsSettings() {
  return <GenericSettings icon={Puzzle} title="Integrations" description="Connect CRM, enrichment, email, and productivity tools." />;
}
export function ICPSettings() {
  return <GenericSettings icon={Target} title="Ideal Customer Profile" description="Define your ideal customer profile for intelligent prospect scoring." />;
}
export function PersonasSettings() {
  return <GenericSettings icon={UserCheck} title="Personas" description="Create buyer personas to target the right decision-makers." />;
}
export function BuyingIntentSettings() {
  return <GenericSettings icon={Eye} title="Buying Intent" description="Configure buying intent signals and scoring thresholds." />;
}
export function WebsiteVisitorsSettings() {
  return <GenericSettings icon={Globe2} title="Website Visitors" description="Track and identify anonymous website visitors as potential leads." />;
}
export function SignalsSettings() {
  return <GenericSettings icon={Signal} title="Signals" description="Configure trigger signals for automated outreach and alerts." />;
}
export function ScoringSettings() {
  return <GenericSettings icon={Star} title="Scoring" description="Define lead and account scoring models for prioritization." />;
}
export function AIContextSettings() {
  return <GenericSettings icon={Brain} title="AI Context Center" description="Manage AI context, training data, and personalization rules." />;
}
export function RulesOfEngagementSettings() {
  return <GenericSettings icon={Scale} title="Rules of Engagement" description="Set rules for territory management and prospect ownership." />;
}
export function ProspectingConfigSettings() {
  return <GenericSettings icon={Crosshair} title="Prospecting Config" description="Configure automated prospecting behavior and limits." />;
}
export function SnippetsSettings() {
  return <GenericSettings icon={FileText} title="Snippets" description="Create reusable text snippets for emails, calls, and messages." />;
}

// Team Operations
export function TeamEmailSequencesSettings() {
  return <GenericSettings icon={Mail} title="Team Email & Sequences" description="Configure team-wide email and sequence defaults." />;
}
export function TrackingSettings() {
  return <GenericSettings icon={Activity} title="Tracking" description="Set up email open, click, and website visit tracking." />;
}
export function TeamSequencesSettings() {
  return <GenericSettings icon={GitBranch} title="Sequences" description="Manage team sequence templates and sharing rules." />;
}
export function TeamDialerSettings() {
  return <GenericSettings icon={PhoneCall} title="Team Dialer" description="Configure team dialer settings, call routing, and recording." />;
}
export function TeamConversationsSettings() {
  return <GenericSettings icon={MessageSquare} title="Team Conversations" description="Set up team conversation routing and assignment rules." />;
}
export function RecordingSettings() {
  return <GenericSettings icon={Video} title="Recording Config" description="Configure call and meeting recording policies." />;
}
export function TeamPermissionsSettings() {
  return <GenericSettings icon={Shield} title="Team Permissions" description="Define role-based access and permission templates." />;
}
export function TrackersSettings() {
  return <GenericSettings icon={ListChecks} title="Trackers" description="Set up keyword and competitor trackers for conversations." />;
}
export function ScorecardsSettings() {
  return <GenericSettings icon={ClipboardList} title="Scorecards" description="Create call and meeting scorecards for team coaching." />;
}
export { default as FieldMappingsSettings } from "./FieldMappingsPage";
export function TeamMeetingsSettings() {
  return <GenericSettings icon={CalendarDays} title="Team Meetings" description="Configure meeting scheduling, reminders, and defaults." />;
}
export function TeamSharingSettings() {
  return <GenericSettings icon={Share2} title="Team Sharing & Defaults" description="Set team sharing rules and default visibility." />;
}

// System Activity — NOW FUNCTIONAL
export function DataRequestsSettings() {
  return <GenericSettings icon={Download} title="Data Requests" description="View and manage data export and deletion requests." />;
}
export function SystemActivityLogSettings() {
  return (
    <PageShell icon={Activity} title="System Activity Log" description="Audit log of all system events, changes, and admin actions.">
      <SystemActivityLogViewer />
    </PageShell>
  );
}

// Data Management — NOW FUNCTIONAL
export function DMAnalyticsSettings() {
  return <GenericSettings icon={BarChart3} title="Analytics" description="Configure analytics dashboards and reporting." />;
}
export function GoalsSettings() {
  return (
    <PageShell icon={Flag} title="Goals" description="Set team and individual performance goals.">
      <GoalsManager />
    </PageShell>
  );
}
export function ContactFieldsSettings() {
  return (
    <PageShell icon={Users} title="Contact Fields & Stages" description="Customize contact fields, lifecycle stages, and required fields.">
      <div className="space-y-8">
        <PipelineStagesManager entityType="contact" title="Contact Lifecycle Stages" description="Define the stages contacts move through in your pipeline." />
        <CustomFieldsManager entityType="contact" title="Custom Contact Fields" description="Add custom fields to capture data specific to your workflow." />
      </div>
    </PageShell>
  );
}
export function AccountFieldsSettings() {
  return (
    <PageShell icon={Layers} title="Account Fields & Stages" description="Customize company/account fields and pipeline stages.">
      <div className="space-y-8">
        <PipelineStagesManager entityType="company" title="Account Pipeline Stages" description="Define the stages accounts move through in your pipeline." />
        <CustomFieldsManager entityType="company" title="Custom Account Fields" description="Add custom fields to capture account-specific data." />
      </div>
    </PageShell>
  );
}
export function DealFieldsSettings() {
  return (
    <PageShell icon={CreditCard} title="Deal Fields & Stages" description="Configure deal pipeline stages, fields, and close reasons.">
      <div className="space-y-8">
        <PipelineStagesManager entityType="deal" title="Deal Pipeline Stages" description="Define deal stages from discovery to close." />
        <CustomFieldsManager entityType="deal" title="Custom Deal Fields" description="Add custom fields for deal-specific data." />
      </div>
    </PageShell>
  );
}
export function GlobalPicklistsSettings() {
  return (
    <PageShell icon={ListChecks} title="Global Picklists" description="Manage shared dropdown values used across objects.">
      <GlobalPicklistsManager />
    </PageShell>
  );
}
export { default as ImportsExportsSettings } from "./ImportsExportsPage";
