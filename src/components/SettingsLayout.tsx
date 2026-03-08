import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Search, User, Mail, Phone, Bell, Chrome, MessageSquare,
  Shield, Users, Globe, Inbox, CreditCard, Zap, Puzzle,
  Target, UserCheck, Eye, Globe2, Signal, Star, Brain,
  Scale, Crosshair, FileText, UsersRound, Activity as ActivityIcon,
  BarChart3, Flag, Layers, Download, GitBranch, PhoneCall,
  Video, Lock, ListChecks, Map, CalendarDays, Share2,
  ClipboardList, Settings, Clock, Route, ShieldBan,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SettingsNavItem {
  label: string;
  path: string;
  icon: any;
}

interface SettingsNavSection {
  title: string;
  items: SettingsNavItem[];
}

const settingsSections: SettingsNavSection[] = [
  {
    title: "Personal Settings",
    items: [
      { label: "Profile", path: "/settings/search/profile", icon: User },
      { label: "Mailboxes & Domains", path: "/settings/search/mailboxes-domains", icon: Mail },
      { label: "Phone Numbers", path: "/settings/search/phone-numbers", icon: Phone },
      { label: "Notifications", path: "/settings/search/notifications", icon: Bell },
      { label: "Chrome Extension", path: "/settings/search/chrome-extension", icon: Chrome },
      { label: "Conversations", path: "/settings/search/conversations", icon: MessageSquare },
    ],
  },
  {
    title: "Workspace",
    items: [
      { label: "Deliverability Overview", path: "/settings/workspace/deliverability", icon: Inbox },
      { label: "Deliverability Dashboard", path: "/settings/workspace/deliverability/dashboard", icon: ActivityIcon },
      { label: "Domains", path: "/settings/workspace/deliverability/domains", icon: Globe },
      { label: "Mailboxes", path: "/settings/workspace/deliverability/mailboxes", icon: Mail },
      { label: "Sending Windows", path: "/settings/workspace/deliverability/sending-windows", icon: Clock },
      { label: "ESP Routing", path: "/settings/workspace/deliverability/esp-routing", icon: Route },
      { label: "Suppression Lists", path: "/settings/workspace/deliverability/suppression", icon: ShieldBan },
      { label: "Users & Teams", path: "/settings/workspace/users", icon: Users },
      { label: "Security", path: "/settings/workspace/security", icon: Shield },
    ],
  },
  {
    title: "Billing & Credits",
    items: [
      { label: "Plan Overview", path: "/settings/billing/plan-overview", icon: CreditCard },
      { label: "License Settings", path: "/settings/billing/license-settings", icon: Lock },
      { label: "Credits & AI Usage", path: "/settings/billing/credits-ai-usage", icon: Zap },
      { label: "AI Run Usage", path: "/settings/billing/ai-run-usage", icon: Brain },
    ],
  },
  {
    title: "Integrations & Config",
    items: [
      { label: "Integrations", path: "/settings/integrations", icon: Puzzle },
      { label: "Ideal Customer Profile", path: "/settings/integrations/icp", icon: Target },
      { label: "Personas", path: "/settings/integrations/personas", icon: UserCheck },
      { label: "Buying Intent", path: "/settings/integrations/buying-intent", icon: Eye },
      { label: "Website Visitors", path: "/settings/integrations/website-visitors", icon: Globe2 },
      { label: "Signals", path: "/settings/integrations/signals", icon: Signal },
      { label: "Scoring", path: "/settings/integrations/scoring", icon: Star },
      { label: "AI Context Center", path: "/settings/integrations/ai-context", icon: Brain },
      { label: "Rules of Engagement", path: "/settings/integrations/rules-of-engagement", icon: Scale },
      { label: "Prospecting Config", path: "/settings/integrations/prospecting-config", icon: Crosshair },
      { label: "Snippets", path: "/settings/integrations/snippets", icon: FileText },
    ],
  },
  {
    title: "Team Operations",
    items: [
      { label: "Team Email & Sequences", path: "/settings/team/email-sequences", icon: Mail },
      { label: "Tracking", path: "/settings/team/tracking", icon: ActivityIcon },
      { label: "Sequences", path: "/settings/team/sequences", icon: GitBranch },
      { label: "Team Dialer", path: "/settings/team/dialer", icon: PhoneCall },
      { label: "Team Conversations", path: "/settings/team/conversations", icon: MessageSquare },
      { label: "Recording Config", path: "/settings/team/recording", icon: Video },
      { label: "Team Permissions", path: "/settings/team/permissions", icon: Shield },
      { label: "Trackers", path: "/settings/team/trackers", icon: ListChecks },
      { label: "Scorecards", path: "/settings/team/scorecards", icon: ClipboardList },
      { label: "Field Mappings", path: "/settings/team/field-mappings", icon: Map },
      { label: "Team Meetings", path: "/settings/team/meetings", icon: CalendarDays },
      { label: "Team Sharing & Defaults", path: "/settings/team/sharing-defaults", icon: Share2 },
    ],
  },
  {
    title: "System Activity",
    items: [
      { label: "Data Requests", path: "/settings/system-activity/data-requests", icon: Download },
      { label: "System Activity Log", path: "/settings/system-activity/log", icon: ActivityIcon },
    ],
  },
  {
    title: "Data Management",
    items: [
      { label: "Analytics", path: "/settings/data-management/analytics", icon: BarChart3 },
      { label: "Goals", path: "/settings/data-management/goals", icon: Flag },
      { label: "Contact Fields & Stages", path: "/settings/data-management/contact-fields-stages", icon: Users },
      { label: "Account Fields & Stages", path: "/settings/data-management/account-fields-stages", icon: Layers },
      { label: "Deal Fields & Stages", path: "/settings/data-management/deal-fields-stages", icon: CreditCard },
      { label: "Global Picklists", path: "/settings/data-management/global-picklists", icon: ListChecks },
      { label: "Imports & Exports", path: "/settings/data-management/imports-exports", icon: Download },
    ],
  },
];

export function SettingsLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex h-full">
      {/* Settings Sidebar */}
      <aside className="w-64 shrink-0 border-r bg-muted/30">
        <div className="px-4 py-4 border-b">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </h2>
        </div>
        <ScrollArea className="h-[calc(100vh-8rem)]">
          <div className="p-2 space-y-4">
            {settingsSections.map((section) => (
              <div key={section.title}>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {section.title}
                </div>
                <nav className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = location.pathname === item.path ||
                      (item.path !== "/settings/integrations" && location.pathname.startsWith(item.path + "/"));
                    return (
                      <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] text-left transition-colors",
                          active
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <item.icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Settings Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
