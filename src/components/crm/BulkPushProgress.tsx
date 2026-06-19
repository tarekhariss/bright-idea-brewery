/**
 * BulkPushProgress — shared progress UI for bulk Push to CRM operations.
 * Drives a single helper `runBulkPush` that batches client-side and tracks
 * total / processed / created / updated / failed.
 */
import { Progress } from "@/components/ui/progress";
import { pushToCrm, type PushToCrmPayload } from "@/hooks/use-opportunities";

export interface BulkPushProgressState {
  total: number;
  processed: number;
  created: number;
  updated: number;
  failed: number;
  running: boolean;
}

export const initialBulkPushState: BulkPushProgressState = {
  total: 0, processed: 0, created: 0, updated: 0, failed: 0, running: false,
};

export async function runBulkPush(
  workspaceId: string,
  payloads: PushToCrmPayload[],
  onProgress: (s: BulkPushProgressState) => void,
): Promise<BulkPushProgressState> {
  const state: BulkPushProgressState = {
    total: payloads.length, processed: 0, created: 0, updated: 0, failed: 0, running: true,
  };
  onProgress({ ...state });
  for (const payload of payloads) {
    const r = await pushToCrm(workspaceId, payload);
    if (!r) state.failed++;
    else if (r.created) state.created++;
    else state.updated++;
    state.processed++;
    onProgress({ ...state });
  }
  state.running = false;
  onProgress({ ...state });
  return state;
}

export function BulkPushProgressBar({ state }: { state: BulkPushProgressState }) {
  if (state.total === 0) return null;
  const pct = Math.round((state.processed / state.total) * 100);
  return (
    <div className="space-y-2 rounded-md border p-3 bg-muted/30">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{state.running ? "Pushing…" : "Done"}</span>
        <span className="text-muted-foreground tabular-nums">{state.processed} / {state.total}</span>
      </div>
      <Progress value={pct} />
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground tabular-nums">
        <span><span className="font-medium text-foreground">{state.created}</span> created</span>
        <span><span className="font-medium text-foreground">{state.updated}</span> updated</span>
        <span className={state.failed ? "text-red-600 dark:text-red-300" : ""}>
          <span className="font-medium">{state.failed}</span> failed
        </span>
      </div>
    </div>
  );
}
