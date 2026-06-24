import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const logAttempt = async (success: boolean, errorMessage?: string) => {
    try {
      await (supabase as any).rpc("record_login_attempt", {
        p_email: email,
        p_success: success,
        p_error_message: errorMessage ?? null,
        p_user_agent: navigator.userAgent,
      });
    } catch {
      // audit logging should never block login flow
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Check allowlist before attempting auth
    const { data: allowed, error: rpcErr } = await (supabase as any).rpc("is_email_allowed", { p_email: email });

    if (rpcErr || !allowed) {
      await logAttempt(false, "Email not on allowlist");
      setLoading(false);
      toast({ title: "Access denied", description: "This email is not authorized to access the platform.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      await logAttempt(false, error.message);
      setLoading(false);
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    } else {
      await logAttempt(true);
      setLoading(false);
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <img src={logo} alt="Leads Bridge" className="h-16 w-auto" />
          </div>
          <CardTitle className="text-2xl font-semibold">Sign in</CardTitle>
          <CardDescription>TLBG Prospect Intelligence Platform</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
            <div className="flex justify-end text-sm">
              <Link to="/forgot-password" className="text-muted-foreground hover:underline">Forgot password?</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
