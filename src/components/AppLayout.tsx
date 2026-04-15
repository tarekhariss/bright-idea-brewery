import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, workspaceId, workspaces } = useAuth();
  const location = useLocation();
  const [workspaceBannerDismissed, setWorkspaceBannerDismissed] = useState(false);

  const showWorkspaceBanner = !workspaceId && workspaces.length === 0 && location.pathname !== "/onboarding" && !workspaceBannerDismissed;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-2 border-b bg-card px-4 shrink-0">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-xs font-medium text-primary-foreground">
                {user?.email?.charAt(0).toUpperCase() ?? "U"}
              </div>
            </div>
          </header>
          {showWorkspaceBanner && (
            <div className="border-b bg-muted/40 px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">You can use the app now and set up a workspace later.</p>
                  <p className="text-xs text-muted-foreground">Create a workspace when you're ready, or wait until someone invites you to one.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild size="sm">
                    <Link to="/onboarding">Create or join later</Link>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setWorkspaceBannerDismissed(true)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          )}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
