import { Link } from "react-router-dom";
import { Columns3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useOpportunities } from "@/hooks/use-opportunities";

export default function PipelinePage() {
  const { stages, byStage, loading, transition } = useOpportunities();

  function onDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.setData("text/opp", id);
    e.dataTransfer.effectAllowed = "move";
  }
  function onDrop(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/opp");
    if (id) transition(id, stageId, null);
  }

  return (
    <div className="p-6 space-y-4 h-full flex flex-col">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Columns3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Pipeline</h1>
          <p className="text-sm text-muted-foreground">Drag opportunities between stages.</p>
        </div>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!loading && stages.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">No pipeline stages yet.</Card>
      )}

      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-3 min-w-max h-full">
          {stages.map((s) => {
            const items = byStage.map.get(s.id) ?? [];
            return (
              <div
                key={s.id}
                className="w-72 shrink-0 flex flex-col rounded-lg border bg-card"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, s.id)}
              >
                <div className="px-3 py-2 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color ?? "#94a3b8" }} />
                    <span className="font-medium text-sm">{s.stage_name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]">
                  {items.map((o) => (
                    <Link
                      key={o.id}
                      to={`/crm/opportunities/${o.id}`}
                      draggable
                      onDragStart={(e) => onDragStart(e, o.id)}
                      className="block rounded-md border bg-background p-2 hover:bg-accent cursor-grab active:cursor-grabbing"
                    >
                      <div className="font-medium text-sm truncate">
                        {o.title || `${o.contact?.first_name ?? ""} ${o.contact?.last_name ?? ""}`.trim() || o.company?.name || "Untitled"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {o.company?.name ?? o.contact?.email ?? ""}
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <Badge variant="outline" className="text-[10px]">{o.source_channel}</Badge>
                        {o.priority !== "normal" && (
                          <Badge variant="secondary" className="text-[10px]">{o.priority}</Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
