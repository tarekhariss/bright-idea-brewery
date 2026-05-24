import { ReactNode } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  ShieldCheck, LayoutDashboard, Activity, ServerCog, Cpu, ListChecks, Skull, RotateCw,
  Globe, Boxes, AlertOctagon, BadgeAlert, Upload, History, Gauge, KeyRound, Settings2,
  ScrollText, Sparkles, ArrowLeft, LogOut, Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useVerificationOverview, useVerificationWorkers } from "@/hooks/use-verification-platform";

interface NavItem {
  title: string;
  url: string;
  icon: any;
  end?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/verification", icon: LayoutDashboard, end: true },
      { title: "List Quality", url: "/verification/list-quality", icon: Gauge },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Jobs", url: "/verification/jobs", icon: ListChecks },
      { title: "Queue Monitor", url: "/verification/queue", icon: Activity },
      { title: "Workers", url: "/verification/workers", icon: ServerCog },
      { title: "Retry Pipeline", url: "/verification/retries", icon: RotateCw },
      { title: "Dead Letter", url: "/verification/dead-letter", icon: Skull },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { title: "Domains", url: "/verification/domains", icon: Globe },
      { title: "Providers", url: "/verification/providers", icon: Boxes },
      { title: "Bounces", url: "/verification/bounces", icon: AlertOctagon },
      { title: "Catch-All", url: "/verification/catch-all", icon: BadgeAlert },
    ],
  },
  {
    label: "Lists",
    items: [
      { title: "Imports", url: "/verification/imports", icon: Upload },
      { title: "History", url: "/verification/history", icon: History },
      { title: "Suppression", url: "/verification/suppression", icon: ShieldCheck },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Rules Engine", url: "/verification/rules", icon: Settings2 },
      { title: "Engines", url: "/verification/engines", icon: Cpu },
      { title: "API", url: "/verification/api", icon: KeyRound },
      { title: "Quotas", url: "/verification/quotas", icon: Gauge },
      { title: "Audit Log", url: "/verification/audit", icon: ScrollText },
    ],
  },
  {
    label: "Future",
    items: [{ title: "AI Scoring", url: "/verification/ai", icon: Sparkles }],
  },
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
              "group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
              "text-muted-foreground hover:bg-accent hover:text-foreground",
              isActive && "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/15 hover:text-emerald-500"
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-emerald-500" />
              )}
              <item.icon className="h-[17px] w-[17px]" strokeWidth={2} />
            </>
          )}
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">{item.title}</TooltipContent>
    </Tooltip>
  );
}

function HeaderStatusBar() {
  const { data: overview } = useVerificationOverview();
  const { data: workers = [] } = useVerificationWorkers();

  const onlineWorkers = workers.filter(
    (w: any) => w.status === "online" || w.status === "idle"
  ).length;
  const adapterUp = onlineWorkers > 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs">
        <span className={cn("h-1.5 w-1.5 rounded-full", adapterUp ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
        <span className="text-muted-foreground">Workers</span>
        <span className="font-medium tabular-nums">{onlineWorkers}/{workers.length}</span>
      </div>
      <div className="flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs">
        <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">In flight</span>
        <span className="font-medium tabular-nums">{overview?.jobs_in_progress ?? 0}</span>
      </div>
      <div className="flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs">
        <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Cache hit</span>
        <span className="font-medium tabular-nums">{overview?.cache_hit_rate ?? 0}%</span>
      </div>
      <div className="flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs">
        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Quota</span>
        <span className="font-medium tabular-nums">
          {overview?.quota?.used_today ?? 0}/{overview?.quota?.daily_limit ?? "—"}
        </span>
      </div>
    </div>
  );
}

export function VerificationLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  const pageTitle = (() => {
    const flat = sections.flatMap((s) => s.items);
    const match = flat
      .filter((i) => (i.end ? location.pathname === i.url : location.pathname.startsWith(i.url)))
      .sort((a, b) => b.url.length - a.url.length)[0];
    return match?.title ?? "Verification";
  })();

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        <aside className="flex w-16 shrink-0 flex-col items-center border-r bg-card py-3">
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate("/")}
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm transition-transform hover:scale-105"
                aria-label="Back to platform"
              >
                <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              <div className="font-medium">Verification</div>
              <div className="text-[10px] text-muted-foreground">Click to exit</div>
            </TooltipContent>
          </Tooltip>

          <div className="my-2 h-px w-8 bg-border" />

          <nav className="flex flex-1 flex-col items-center gap-2 overflow-y-auto pb-2 scrollbar-thin">
            {sections.map((section, i) => (
              <div key={section.label} className="flex flex-col items-center gap-1">
                {section.items.map((item) => (
                  <NavIcon key={item.url} item={item} />
                ))}
                {i < sections.length - 1 && <div className="my-1 h-px w-6 bg-border/60" />}
              </div>
            ))}
          </nav>

          <div className="flex flex-col items-center gap-1.5 pt-2">
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate("/")}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Back to CRM"
                >
                  <ArrowLeft className="h-[17px] w-[17px]" strokeWidth={2} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Back to CRM</TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <button
                  onClick={signOut}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Sign out"
                >
                  <LogOut className="h-[17px] w-[17px]" strokeWidth={2} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Sign out</TooltipContent>
            </Tooltip>
            <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-medium text-white">
              {user?.email?.charAt(0).toUpperCase() ?? "U"}
            </div>
          </div>
        </aside>

        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-14 items-center justify-between border-b bg-card/40 px-6 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Verification Infrastructure</span>
                <span className="text-sm font-semibold">{pageTitle}</span>
              </div>
            </div>
            <HeaderStatusBar />
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
