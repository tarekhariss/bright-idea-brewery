import { User } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ProfileSettings() {
  const { user, role } = useAuth();

  return (
    <PageShell icon={User} title="Profile" description="Manage your personal profile and account preferences.">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Email</Label>
              <Input value={user?.email ?? ""} disabled className="mt-1 h-9 text-sm bg-muted" />
            </div>
            <div>
              <Label className="text-xs">Full Name</Label>
              <Input placeholder="Enter your full name" className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Role</Label>
              <div className="mt-1">
                <Badge variant="secondary" className="text-xs capitalize">{role ?? "No role assigned"}</Badge>
              </div>
            </div>
            <Button size="sm" className="text-xs">Save Changes</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Password</Label>
              <p className="text-xs text-muted-foreground mt-1">Change your password to keep your account secure.</p>
              <Button variant="outline" size="sm" className="mt-2 text-xs">Change Password</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
