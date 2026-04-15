import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Building2, AlertCircle, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function WorkspaceOnboarding() {
  const navigate = useNavigate();
  const { createWorkspace, signOut, user, workspaceId, workspaces } = useAuth();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const hasWorkspace = !!workspaceId || workspaces.length > 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);

    try {
      const ws = await createWorkspace(name.trim());
      if (ws) {
        toast.success(`Workspace "${ws.name}" created`);
        navigate("/");
      } else {
        setRetryCount((c) => c + 1);
        setError("Failed to create workspace. Please try again.");
      }
    } catch (err: any) {
      setRetryCount((c) => c + 1);
      setError(err?.message || "An unexpected error occurred. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-semibold">Workspace Setup</CardTitle>
          <CardDescription>
            Creating a workspace is optional right now. You can set one up now, or come back later when you're ready or after someone invites you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasWorkspace && (
            <Alert>
              <AlertDescription>
                You already have access to a workspace. You can go straight back into the app.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
                {retryCount >= 2 && (
                  <span className="block mt-1 text-xs">
                    You can continue using the app without a workspace for now, then try again later.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace Name</Label>
              <Input
                id="workspace-name"
                placeholder="e.g. Acme Sales Team"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                You can invite team members and change this later.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={creating || !name.trim()}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {retryCount > 0 ? "Retry" : "Create Workspace"}
            </Button>
          </form>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={() => navigate("/")}>Skip for now</Button>
            {hasWorkspace && <Button variant="secondary" onClick={() => navigate("/")}>Go to dashboard</Button>}
          </div>

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground text-center mb-2">
              Signed in as {user?.email}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => signOut()}
            >
              <LogOut className="mr-2 h-3 w-3" />
              Sign out and use a different account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
