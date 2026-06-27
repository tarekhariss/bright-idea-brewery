import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";

/**
 * Reads platform_settings.imports_paused and renders a prominent banner when
 * imports are globally paused (e.g. during the enterprise dedupe rollout).
 *
 * Backend `run-import-job` also enforces this with a 423 response, so this
 * banner is the user-facing surface of that guard.
 */
export function ImportPauseBanner() {
  const { data } = useQuery({
    queryKey: ["platform-settings", "imports_paused"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("platform_settings")
        .select("value")
        .eq("key", "imports_paused")
        .maybeSingle();
      if (error) return null;
      return data?.value ?? null;
    },
    staleTime: 30_000,
  });

  const paused = (data as any)?.paused === true;
  if (!paused) return null;
  const reason =
    (data as any)?.reason ?? "New imports are temporarily paused by an administrator.";

  return (
    <div className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
      <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div>
        <div className="font-semibold">Imports are paused</div>
        <div className="text-amber-900/80 dark:text-amber-200/80">
          {reason} You can finish configuring an import, but the job will be
          refused at submit until imports are resumed.
        </div>
      </div>
    </div>
  );
}
