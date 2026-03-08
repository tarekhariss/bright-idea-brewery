import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, List, Upload } from "lucide-react";

interface Stats {
  contacts: number;
  companies: number;
  lists: number;
  imports: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ contacts: 0, companies: 0, lists: 0, imports: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const [c, co, l, i] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("lists").select("id", { count: "exact", head: true }),
        supabase.from("import_jobs").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        contacts: c.count ?? 0,
        companies: co.count ?? 0,
        lists: l.count ?? 0,
        imports: i.count ?? 0,
      });
      setLoading(false);
    }
    fetchStats();
  }, []);

  const cards = [
    { label: "Total Contacts", value: stats.contacts, icon: Users, color: "text-primary" },
    { label: "Companies", value: stats.companies, icon: Building2, color: "text-success" },
    { label: "Lists", value: stats.lists, icon: List, color: "text-warning" },
    { label: "Import Jobs", value: stats.imports, icon: Upload, color: "text-chart-4" },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview of your prospect intelligence platform</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? "—" : c.value.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Getting Started</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Welcome to the TLBG Prospect Intelligence Platform. Here's what you can do:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Browse and search <strong>Contacts</strong> and <strong>Companies</strong></li>
            <li>Create <strong>Lists</strong> to segment your prospects</li>
            <li>Use the <strong>Import Center</strong> to upload CSV files</li>
            <li>Set up <strong>Saved Views</strong> for quick access to filtered data</li>
            <li>Monitor <strong>Data Health</strong> for quality scoring</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
