import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bookmark, Star, Eye } from "lucide-react";
import { format } from "date-fns";
import type { SavedView } from "@/hooks/use-saved-views";

const db = () => supabase as any;

export default function SavedViewsPage() {
  const navigate = useNavigate();
  const { workspaceId } = useAuth();
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    async function load() {
      const { data } = await db()
        .from("saved_views")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("is_default", { ascending: false })
        .order("updated_at", { ascending: false });
      setViews((data as SavedView[]) ?? []);
      setLoading(false);
    }
    load();
  }, [workspaceId]);

  const fmtDate = (d: string) => { try { return format(new Date(d), "MMM d, yyyy"); } catch { return "—"; } };

  const handleClick = (view: SavedView) => {
    const path = view.entity_type === "contact" ? "/contacts" : "/companies";
    navigate(`${path}?view=${view.id}`);
  };

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Saved Views</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage custom filters and column layouts across Contacts and Companies</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : views.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Bookmark className="h-10 w-10 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium">No saved views yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Go to Contacts or Companies, configure your filters and columns, then click the Views button to save your configuration.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {views.map((view) => (
            <Card
              key={view.id}
              className="cursor-pointer hover:border-primary/30 transition-colors group"
              onClick={() => handleClick(view)}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {view.is_default && <Star className="h-3.5 w-3.5 text-warning fill-warning shrink-0" />}
                    <h3 className="text-sm font-semibold group-hover:text-primary transition-colors truncate">{view.name}</h3>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0 ml-2 capitalize">
                    {view.entity_type === "contact" ? "Contacts" : "Companies"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {view.sort_by ? `Sort: ${view.sort_by}` : "Default sort"}
                  </span>
                  <span>· Updated {fmtDate(view.updated_at)}</span>
                </div>
                {view.filters && typeof view.filters === "object" && (view.filters as any).filterValues && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries((view.filters as any).filterValues as Record<string, string>)
                      .filter(([_, v]) => v && v !== "all" && v !== "")
                      .slice(0, 3)
                      .map(([key, value]) => (
                        <Badge key={key} variant="secondary" className="text-[10px]">
                          {key}: {value}
                        </Badge>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
