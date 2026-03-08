import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Search, Users, Building2, List, Sparkles, Brain,
  Send, Mail, Phone, CheckSquare, Megaphone, FileText, Inbox, Linkedin,
  Handshake, MessageSquare, CalendarCheck, DollarSign,
  Wrench, GitBranch, BarChart3,
  Database, Settings, LogOut, ChevronRight,
  Upload, Activity, Bookmark, LayoutDashboard, ShieldCheck,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface NavItem {
  title: string;
  url: string;
  icon: any;
  end?: boolean;
}

interface NavGroup {
  label: string;
  icon: any;
  basePath: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Search",
    icon: Search,
    basePath: "/search",
    items: [
      { title: "Prospect & Enrich", url: "/search", icon: Sparkles, end: true },
      { title: "Intelligence", url: "/search/intelligence", icon: Brain },
      { title: "People", url: "/search/people", icon: Users },
      { title: "Companies", url: "/search/companies", icon: Building2 },
      { title: "Lists", url: "/search/lists", icon: List },
      { title: "Data Enrichment", url: "/search/data-enrichment", icon: Database },
    ],
  },
  {
    label: "Engage",
    icon: Send,
    basePath: "/engage",
    items: [
      { title: "Sequences", url: "/engage/sequences", icon: GitBranch },
      { title: "Campaigns", url: "/engage/campaigns", icon: Megaphone },
      { title: "LinkedIn", url: "/engage/linkedin", icon: Linkedin },
      { title: "Templates", url: "/engage/templates", icon: FileText },
      { title: "Emails", url: "/engage/emails", icon: Mail },
      { title: "Calls", url: "/engage/calls", icon: Phone },
      { title: "Tasks", url: "/engage/tasks", icon: CheckSquare },
      { title: "Inbox", url: "/engage/inbox", icon: Inbox },
    ],
  },
  {
    label: "Deals",
    icon: Handshake,
    basePath: "/deals",
    items: [
      { title: "Meetings", url: "/deals/meetings", icon: CalendarCheck },
      { title: "Conversations", url: "/deals/conversations", icon: MessageSquare },
      { title: "Deals", url: "/deals/deals", icon: DollarSign },
    ],
  },
  {
    label: "Tools",
    icon: Wrench,
    basePath: "/tools",
    items: [
      { title: "Workflows", url: "/tools/workflows", icon: GitBranch },
      { title: "Analytics", url: "/tools/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Records",
    icon: Database,
    basePath: "/records",
    items: [
      { title: "People", url: "/records/people", icon: Users },
      { title: "Companies", url: "/records/companies", icon: Building2 },
    ],
  },
];

const quickLinks: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, end: true },
  { title: "Import Center", url: "/imports", icon: Upload },
  { title: "Data Health", url: "/data-health", icon: Activity },
  { title: "Saved Views", url: "/saved-views", icon: Bookmark },
];

function CollapsibleNavGroup({ group, collapsed }: { group: NavGroup; collapsed: boolean }) {
  const location = useLocation();
  const isActive = location.pathname.startsWith(group.basePath);
  const [open, setOpen] = useState(isActive);

  if (collapsed) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <NavLink
              to={group.items[0].url}
              className={cn(
                "flex items-center justify-center rounded-md p-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
              activeClassName=""
            >
              <group.icon className="h-4 w-4" />
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium uppercase tracking-wider text-sidebar-muted transition-colors hover:text-sidebar-foreground group">
        <group.icon className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronRight className={cn("h-3 w-3 transition-transform duration-200", open && "rotate-90")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenu className="mt-0.5 ml-2 border-l border-sidebar-border pl-2">
          {group.items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.url}
                  end={item.end}
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut, isAdmin } = useAuth();

  return (
    <Sidebar collapsible="icon" className="sidebar-gradient border-r-0">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 px-4 border-b border-sidebar-border shrink-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
          <span className="text-xs font-bold text-sidebar-primary-foreground">TB</span>
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-sidebar-accent-foreground truncate">TLBG</span>
            <span className="text-[10px] text-sidebar-muted leading-tight truncate">Prospect Intelligence</span>
          </div>
        )}
      </div>

      <SidebarContent className="pt-2 px-2 space-y-1">
        {/* Quick Links */}
        <SidebarGroup>
          {!collapsed && (
            <div className="px-3 pb-1 text-[10px] font-medium uppercase tracking-widest text-sidebar-muted/60">
              Quick Access
            </div>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {quickLinks.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.end}
                      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Divider */}
        <div className="mx-3 border-t border-sidebar-border" />

        {/* Nav Groups */}
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-0.5">
            <SidebarGroupContent>
              <CollapsibleNavGroup group={group} collapsed={collapsed} />
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {/* Admin */}
        {isAdmin && (
          <>
            <div className="mx-3 border-t border-sidebar-border" />
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/admin"
                        className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <ShieldCheck className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>Platform Admin</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Divider */}
        <div className="mx-3 border-t border-sidebar-border" />

        {/* Settings */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/settings"
                    className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  >
                    <Settings className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Settings</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
