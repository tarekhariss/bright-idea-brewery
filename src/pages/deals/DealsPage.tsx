/**
 * DealsPage — basic database-backed Deals module (Round 3A).
 *
 * Provides list + Kanban views, create/edit/delete, drag deal between stages.
 * Intentionally minimal: no activity timeline, no stage history, no automation.
 */
import { useMemo, useState } from "react";
import { DollarSign, Plus, Pencil, Trash2, LayoutGrid, List, GripVertical, Building2, User } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDeals, type Deal, type PipelineStage } from "@/hooks/use-deals";
import { DealDialog } from "./DealDialog";
import { PushToCrmButton } from "@/components/crm/PushToCrmButton";

function formatMoney(amount: number | null, currency: string | null) {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency ?? ""} ${amount}`;
  }
}

function statusVariant(s: Deal["status"]): "default" | "secondary" | "destructive" | "outline" {
  switch (s) {
    case "won": return "default";
    case "lost":
    case "abandoned": return "destructive";
    default: return "secondary";
  }
}

export default function DealsPage() {
  const {
    deals, stages, loading, dealsByStage,
    upsertDeal, deleteDeal, moveDealToStage,
  } = useDeals();

  const [view, setView] = useState<"list" | "kanban">("kanban");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const totalByStage = useMemo(() => {
    const m = new Map<string, number>();
    stages.forEach((s) => {
      const ds = dealsByStage.map.get(s.id) ?? [];
      m.set(s.id, ds.reduce((sum, d) => sum + (d.amount ?? 0), 0));
    });
    return m;
  }, [stages, dealsByStage]);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (d: Deal) => { setEditing(d); setDialogOpen(true); };

  // No deal pipeline configured yet → show honest empty state
  if (!loading && stages.length === 0) {
    return (
      <PageShell
        icon={DollarSign}
        title="Deals"
        description="Track deal pipeline, stages, and revenue."
        emptyState={{
          icon: DollarSign,
          title: "No deal pipeline configured",
          description:
            "Set up a deal pipeline and stages in Settings → Deal Fields & Stages before creating deals.",
        }}
      />
    );
  }

  return (
    <PageShell
      icon={DollarSign}
      title="Deals"
      description="Track deal pipeline, stages, and revenue across your team's opportunities."
      actions={
        <div className="flex items-center gap-2">
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as any)} size="sm">
            <ToggleGroupItem value="kanban" aria-label="Kanban view"><LayoutGrid className="h-4 w-4" /></ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view"><List className="h-4 w-4" /></ToggleGroupItem>
          </ToggleGroup>
          <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> New deal</Button>
        </div>
      }
    >
      {loading ? (
        <div className="p-6 text-sm text-muted-foreground">Loading deals…</div>
      ) : view === "kanban" ? (
        <KanbanView
          stages={stages}
          dealsByStage={dealsByStage}
          totalByStage={totalByStage}
          onEdit={openEdit}
          onDelete={deleteDeal}
          onDrop={moveDealToStage}
          draggingId={draggingId}
          setDraggingId={setDraggingId}
        />
      ) : (
        <ListView deals={deals} stages={stages} onEdit={openEdit} onDelete={deleteDeal} />
      )}

      <DealDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        stages={stages}
        deal={editing}
        onSubmit={upsertDeal}
      />
    </PageShell>
  );
}

/* ---------------- Kanban ---------------- */

function KanbanView({
  stages, dealsByStage, totalByStage, onEdit, onDelete, onDrop, draggingId, setDraggingId,
}: {
  stages: PipelineStage[];
  dealsByStage: { map: Map<string, Deal[]>; unstaged: Deal[] };
  totalByStage: Map<string, number>;
  onEdit: (d: Deal) => void;
  onDelete: (id: string) => Promise<boolean>;
  onDrop: (dealId: string, stageId: string) => Promise<boolean>;
  draggingId: string | null;
  setDraggingId: (v: string | null) => void;
}) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-max">
        {stages.map((stage) => {
          const items = dealsByStage.map.get(stage.id) ?? [];
          const sum = totalByStage.get(stage.id) ?? 0;
          return (
            <div
              key={stage.id}
              className="w-80 shrink-0 rounded-lg border bg-muted/30"
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || draggingId;
                if (id) onDrop(id, stage.id);
                setDraggingId(null);
              }}
            >
              <div className="px-3 py-2 border-b flex items-center justify-between sticky top-0 bg-muted/60 rounded-t-lg">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{stage.stage_name}</span>
                  <Badge variant="outline" className="text-xs">{items.length}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatMoney(sum, items[0]?.currency ?? "USD")}
                </span>
              </div>
              <div className="p-2 space-y-2 min-h-[120px]">
                {items.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic px-2 py-6 text-center">
                    Drop deals here
                  </div>
                ) : (
                  items.map((d) => (
                    <DealCard
                      key={d.id}
                      deal={d}
                      onEdit={() => onEdit(d)}
                      onDelete={() => onDelete(d.id)}
                      onDragStart={() => setDraggingId(d.id)}
                      onDragEnd={() => setDraggingId(null)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}

        {dealsByStage.unstaged.length > 0 && (
          <div className="w-80 shrink-0 rounded-lg border border-dashed bg-background">
            <div className="px-3 py-2 border-b text-sm font-medium text-muted-foreground">
              Unstaged ({dealsByStage.unstaged.length})
            </div>
            <div className="p-2 space-y-2">
              {dealsByStage.unstaged.map((d) => (
                <DealCard
                  key={d.id}
                  deal={d}
                  onEdit={() => onEdit(d)}
                  onDelete={() => onDelete(d.id)}
                  onDragStart={() => setDraggingId(d.id)}
                  onDragEnd={() => setDraggingId(null)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DealCard({
  deal, onEdit, onDelete, onDragStart, onDragEnd,
}: {
  deal: Deal;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <Card
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", deal.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className="cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors"
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <button
              type="button"
              onClick={onEdit}
              className="text-sm font-medium text-left hover:underline truncate"
            >
              {deal.name}
            </button>
          </div>
          <Badge variant={statusVariant(deal.status)} className="text-[10px] uppercase">{deal.status}</Badge>
        </div>
        <div className="text-sm font-semibold">{formatMoney(deal.amount, deal.currency)}</div>
        {(deal.company?.name || deal.owner) && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            {deal.company?.name && (
              <div className="flex items-center gap-1"><Building2 className="h-3 w-3" />{deal.company.name}</div>
            )}
            {deal.owner && (
              <div className="flex items-center gap-1"><User className="h-3 w-3" />{deal.owner.full_name || deal.owner.email}</div>
            )}
          </div>
        )}
        <div className="flex items-center justify-end gap-1 pt-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} aria-label="Edit deal">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <DeleteButton onConfirm={onDelete} dealName={deal.name} />
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- List ---------------- */

function ListView({
  deals, stages, onEdit, onDelete,
}: {
  deals: Deal[];
  stages: PipelineStage[];
  onEdit: (d: Deal) => void;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const stageName = (id: string | null) => stages.find((s) => s.id === id)?.stage_name ?? "—";

  if (deals.length === 0) {
    return (
      <div className="rounded-lg border p-12 text-center text-sm text-muted-foreground">
        No deals yet. Click <strong>New deal</strong> to create your first one.
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Close date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="font-medium">
                <button onClick={() => onEdit(d)} className="hover:underline text-left">{d.name}</button>
              </TableCell>
              <TableCell>{stageName(d.stage_id)}</TableCell>
              <TableCell><Badge variant={statusVariant(d.status)}>{d.status}</Badge></TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(d.amount, d.currency)}</TableCell>
              <TableCell className="text-muted-foreground">{d.company?.name ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{d.owner?.full_name || d.owner?.email || "—"}</TableCell>
              <TableCell className="text-muted-foreground">{d.expected_close_date ?? "—"}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <PushToCrmButton
                    size="sm"
                    variant="ghost"
                    label="CRM"
                    className="h-7 px-2 text-[11px]"
                    companyId={d.company_id ?? null}
                    contactId={d.contacts?.[0]?.contact_id ?? null}
                    sourceChannel="manual_push"
                    defaultTitle={d.name}
                    linkDealId={d.id}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(d)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <DeleteButton onConfirm={() => onDelete(d.id)} dealName={d.name} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DeleteButton({ onConfirm, dealName }: { onConfirm: () => void | Promise<unknown>; dealName: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" aria-label="Delete deal">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete deal?</AlertDialogTitle>
          <AlertDialogDescription>
            "{dealName}" will be permanently removed. Linked contact/company references will be removed but the contacts and companies themselves stay intact.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm()}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
