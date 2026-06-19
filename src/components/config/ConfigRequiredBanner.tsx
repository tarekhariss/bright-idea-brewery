/**
 * ConfigRequiredBanner — persistent inline banner shown at the top of pages
 * whose primary actions cannot run until the user configures a provider.
 *
 * Usage:
 *   <ConfigRequiredBanner capabilities={["email", "domains"]} />
 *
 * Renders nothing when all listed capabilities are ready. When any are missing
 * it lists each one and provides a "Configure now" CTA deep-linking to the
 * matching settings page.
 */
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConfigStatus, type CapabilityKey } from "@/hooks/use-config-status";

interface Props {
  capabilities: CapabilityKey[];
  /** Override the banner title. */
  title?: string;
}

export function ConfigRequiredBanner({ capabilities, title }: Props) {
  const status = useConfigStatus();
  if (status.loading) return null;

  const missing = capabilities
    .map((k) => ({ key: k, cap: status[k] }))
    .filter((x) => !x.cap.ready);

  if (missing.length === 0) return null;

  return (
    <Alert variant="destructive" className="mb-4 border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-100">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{title ?? "Configuration required"}</AlertTitle>
      <AlertDescription className="space-y-2">
        <ul className="mt-1 list-disc pl-5 text-sm">
          {missing.map(({ key, cap }) => (
            <li key={key}>{cap.reason}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 pt-1">
          {missing.map(({ key, cap }) => (
            <Button key={key} asChild size="sm" variant="outline">
              <Link to={cap.fixHref}>
                {cap.fixLabel}
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}
