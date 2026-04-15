import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/hooks/use-workspace";
import { Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";

export default function WorkspaceOnboarding() {
  const { createWorkspace } = useWorkspace();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    const ws = await createWorkspace(name.trim());
    setCreating(false);
    if (ws) {
      toast.success(`Workspace "${ws.name}" created`);
    } else {
      toast.error("Failed to create workspace");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-semibold">Create Your Workspace</CardTitle>
          <CardDescription>
            Set up your workspace to start prospecting. All your contacts, companies, campaigns, and data will live here.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              Create Workspace
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
