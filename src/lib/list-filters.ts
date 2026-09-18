/**
 * List membership filters, expressed in SQL.
 *
 * These were previously resolved client-side: fetch every `list_contacts` row for
 * the chosen lists, then send the IDs back as `in.(...)`. Two things went wrong at
 * scale, both silently:
 *
 *   1. The fetch had no `.limit()`, so PostgREST's 1,000-row default applied. Any
 *      list larger than that filtered against a truncated membership set and
 *      returned wrong rows — no error, no warning.
 *   2. Exclusions inlined every UUID into the request URL. A few thousand of them
 *      (~37 bytes each) exceeded header size limits and the request failed outright.
 *
 * Both directions are now pushed into SQL via aliased resource embeds:
 *
 *   include → `!inner` semi-join      — contact IS in at least one of these lists
 *   exclude → left embed + `is.null`  — contact is in NONE of these lists
 *
 * Aliasing keeps the two embeds distinct when both are active on the same table.
 * Only the list IDs travel in the URL, so request size no longer scales with
 * membership, and correctness no longer depends on list size.
 */

export const INCLUDE_ALIAS = "inc_lists";
export const EXCLUDE_ALIAS = "exc_lists";

/**
 * Embed clauses to append to a `select`, given the active list filters.
 * Returns an empty array when no list filtering is in play, so the query shape
 * is unchanged for the common case.
 */
export function buildListEmbeds(includeLists: string[], excludeLists: string[]): string[] {
  const embeds: string[] = [];
  if (includeLists.length > 0) embeds.push(`${INCLUDE_ALIAS}:list_contacts!inner(list_id)`);
  if (excludeLists.length > 0) embeds.push(`${EXCLUDE_ALIAS}:list_contacts(list_id)`);
  return embeds;
}

/** Append embed clauses to a select string. */
export function withEmbeds(select: string, embeds: string[]): string {
  return embeds.length > 0 ? `${select},${embeds.join(",")}` : select;
}

/**
 * Apply the membership filters to a PostgREST query builder.
 * Must be paired with the embeds from `buildListEmbeds` on the same query.
 */
export function applyListFilters<T>(
  query: T,
  includeLists: string[],
  excludeLists: string[],
): T {
  let q = query as any;

  if (includeLists.length > 0) {
    q = q.in(`${INCLUDE_ALIAS}.list_id`, includeLists);
  }

  if (excludeLists.length > 0) {
    // Scope the embed to the excluded lists, then keep only parents with no match.
    q = q.in(`${EXCLUDE_ALIAS}.list_id`, excludeLists);
    q = q.is(EXCLUDE_ALIAS, null);
  }

  return q as T;
}
