/**
 * Verifies the URL the real supabase-js client produces for list filtering.
 *
 * The unit tests prove our logic against a stand-in builder. This one proves the
 * actual PostgREST request comes out right — the embeds, the aliases, and the
 * anti-join `is.null` — without needing a live database. No request is sent; we
 * only inspect the URL the builder has assembled.
 */
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { applyListFilters, buildListEmbeds, withEmbeds } from "./list-filters";

const client = createClient("http://localhost:54321", "test-anon-key");

const LIST_A = "11111111-1111-1111-1111-111111111111";
const LIST_B = "22222222-2222-2222-2222-222222222222";

/** Build a contacts query the way useProspectSearch does, and return its URL. */
function buildUrl(includeLists: string[], excludeLists: string[]): string {
  const embeds = buildListEmbeds(includeLists, excludeLists);
  const query = client.from("contacts").select(withEmbeds("id,email", embeds));
  const filtered = applyListFilters(query, includeLists, excludeLists);
  return decodeURIComponent((filtered as any).url.toString());
}

describe("generated PostgREST URL", () => {
  it("includes: emits an inner-join embed filtered by list_id", () => {
    const url = buildUrl([LIST_A, LIST_B], []);
    expect(url).toContain("inc_lists:list_contacts!inner(list_id)");
    expect(url).toContain(`inc_lists.list_id=in.(${LIST_A},${LIST_B})`);
  });

  it("excludes: emits a left embed plus the is.null anti-join", () => {
    const url = buildUrl([], [LIST_A]);
    expect(url).toContain("exc_lists:list_contacts(list_id)");
    expect(url).toContain(`exc_lists.list_id=in.(${LIST_A})`);
    expect(url).toContain("exc_lists=is.null");
    // An inner join here would invert the meaning entirely.
    expect(url).not.toContain("exc_lists:list_contacts!inner");
  });

  it("combined: both aliases appear and do not collide", () => {
    const url = buildUrl([LIST_A], [LIST_B]);
    expect(url).toContain("inc_lists:list_contacts!inner(list_id)");
    expect(url).toContain("exc_lists:list_contacts(list_id)");
    expect(url).toContain(`inc_lists.list_id=in.(${LIST_A})`);
    expect(url).toContain(`exc_lists.list_id=in.(${LIST_B})`);
    expect(url).toContain("exc_lists=is.null");
  });

  it("stays compact regardless of list size — no contact ids in the URL", () => {
    const url = buildUrl([LIST_A], [LIST_B]);
    // Two UUIDs plus column names. The old implementation grew with membership
    // and blew past header limits somewhere north of a few thousand contacts.
    expect(url.length).toBeLessThan(400);
  });

  it("adds nothing when no list filters are active", () => {
    const url = buildUrl([], []);
    expect(url).not.toContain("list_contacts");
    expect(url).not.toContain("is.null");
  });
});
