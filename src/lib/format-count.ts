/**
 * Rendering for result counts that may be planner estimates.
 *
 * Broad searches no longer pay for a COUNT(*) over the whole filtered set, so
 * large totals are approximate. Showing "1,203,417" for a number that shifts
 * between refreshes reads as a bug; "~1.2M" reads as what it is.
 */

/** Exact counts render in full; estimates are rounded and marked. */
export function formatResultCount(count: number, isEstimated = false): string {
  if (!isEstimated) return count.toLocaleString();

  if (count >= 1_000_000) {
    const millions = count / 1_000_000;
    return `~${millions >= 10 ? Math.round(millions) : millions.toFixed(1)}M`;
  }
  if (count >= 10_000) {
    return `~${Math.round(count / 1_000)}K`;
  }
  // Round to a readable step rather than implying precision we don't have.
  return `~${(Math.round(count / 100) * 100).toLocaleString()}`;
}
