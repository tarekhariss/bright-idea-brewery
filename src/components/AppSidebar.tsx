import {
  LayoutDashboard,
  Users,
  Building2,
  List,
  Upload,
  Bookmark,
  Activity,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Contacts", url: "/contacts", icon: Users },
  { title: "Companies", url: "/companies", icon: Building2 },
  { title: "Lists", url: "/lists", icon: List },
];

const toolsNav = [
  { title: "Import Center", url: "/imports", icon: Upload },
  { title: "Saved Views", url: "/saved-views", icon: Bookmark },
  { title: "Data Health", url: "/data-health", icon: Activity },
];

const systemNav = [
  { title: "Settings", url: "/settings", icon: Settings },
];

function NavSection({ label, items, collapsed }: { label: string; items: typeof mainNav; collapsed: boolean }) {
  return (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel className="text-sidebar-muted text-xs uppercase tracking-wider">{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.url}
                  end={item.url === "/"}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();

  return (
    <Sidebar collapsible="icon" className="sidebar-gradient border-r-0">
      <div className="flex h-14 items-center gap-2 px-4 border-b border-sidebar-border">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary">
          <span className="text-xs font-bold text-sidebar-primary-foreground">TB</span>
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-accent-foreground">TLBG</span>
            <span className="text-[10px] text-sidebar-muted leading-tight">Prospect Intelligence</span>
          </div>
        )}
      </div>

      <SidebarContent className="pt-2">
        <NavSection label="Main" items={mainNav} collapsed={collapsed} />
        <NavSection label="Tools" items={toolsNav} collapsed={collapsed} />
        <NavSection label="System" items={systemNav} collapsed={collapsed} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
