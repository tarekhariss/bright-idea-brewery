import { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Megaphone, Inbox, AtSign, FileText, BarChart3,
  ArrowLeft, LogOut, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NavItem {
  title: string;
  url: string;
  icon: any;
  end?: boolean;
}

const navItems: NavItem[] = [
  { title: "Campaigns", url: "/engage/campaigns", icon: Megaphone },
  { title: "Unibox", url: "/engage/unibox", icon: Inbox },
  { title: "Email Accounts", url: "/engage/accounts", icon: AtSign },
  { title: "Templates", url: "/engage/templates", icon: FileText },
  { title: "Analytics", url: "/engage/analytics", icon: BarChart3 },
];

function NavIcon({ item }: { item: NavItem }) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <NavLink
          to={item.url}
          end={item.end}
          className={({ isActive }) =>
            cn(
              "group relative flex h-11 w-11 items-center justify-center rounded-lg transition-colors",
              "text-muted-foreground hover:bg-accent hover:text-foreground",
              isActive && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <item.icon className="h-[18px] w-[18px]" strokeWidth={2} />
            </>
          )}
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {item.title}
      </TooltipContent>
    </Tooltip>
  );
}

export function EngageLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        {/* Engage Rail Sidebar */}
        <aside className="flex w-16 shrink-0 flex-col items-center border-r bg-card py-3">
          {/* Engage Brand */}
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate("/")}
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm transition-transform hover:scale-105"
                aria-label="Back to platform"
              >
                <Send className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              <div className="font-medium">Engage</div>
              <div className="text-[10px] text-muted-foreground">Click to exit</div>
            </TooltipContent>
          </Tooltip>

          <div className="my-2 h-px w-8 bg-border" />

          {/* Main nav */}
          <nav className="flex flex-1 flex-col items-center gap-1.5">
            {navItems.map((item) => (
              <NavIcon key={item.url} item={item} />
            ))}
          </nav>

          {/* Footer actions */}
          <div className="flex flex-col items-center gap-1.5 pt-2">
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate("/")}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Back to CRM"
                >
                  <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Back to CRM</TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <button
                  onClick={signOut}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Sign out"
                >
                  <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Sign out</TooltipContent>
            </Tooltip>

            <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground">
              {user?.email?.charAt(0).toUpperCase() ?? "U"}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </TooltipProvider>
  );
}
