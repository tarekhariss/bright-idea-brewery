import { describe, expect, it } from "vitest";
import {
  EXCLUDE_ALIAS,
  INCLUDE_ALIAS,
  applyListFilters,
  buildListEmbeds,
  withEmbeds,
} from "./list-filters";

/** Minimal stand-in for the PostgREST builder, recording the calls made on it. */
function fakeQuery() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const builder: any = {
    calls,
    in(...args: unknown[]) {
      calls.push({ method: "in", args });
      return builder;
    },
    is(...args: unknown[]) {
      calls.push({ method: "is", args });
      return builder;
    },
    not(...args: unknown[]) {
      calls.push({ method: "not", args });
      return builder;
    },
  };
  return builder;
}

const LIST_A = "11111111-1111-1111-1111-111111111111";
const LIST_B = "22222222-2222-2222-2222-222222222222";

describe("buildListEmbeds", () => {
  it("adds no embeds when no list filters are active", () => {
    expect(buildListEmbeds([], [])).toEqual([]);
  });

  it("uses an inner join for includes — a semi-join", () => {
    expect(buildListEmbeds([LIST_A], [])).toEqual([
      `${INCLUDE_ALIAS}:list_contacts!inner(list_id)`,
    ]);
  });

  it("uses a plain left embed for excludes, so parents without matches survive", () => {
    const embeds = buildListEmbeds([], [LIST_A]);
    expect(embeds).toEqual([`${EXCLUDE_ALIAS}:list_contacts(list_id)`]);
    expect(embeds[0]).not.toContain("!inner");
  });

  it("aliases both embeds distinctly when include and exclude are combined", () => {
    const embeds = buildListEmbeds([LIST_A], [LIST_B]);
    expect(embeds).toHaveLength(2);
    expect(embeds[0]).toContain(INCLUDE_ALIAS);
    expect(embeds[1]).toContain(EXCLUDE_ALIAS);
    expect(INCLUDE_ALIAS).not.toBe(EXCLUDE_ALIAS);
  });
});

describe("withEmbeds", () => {
  it("leaves the select untouched when there are no embeds", () => {
    expect(withEmbeds("id,email", [])).toBe("id,email");
  });

  it("appends embeds after the column list", () => {
    expect(withEmbeds("id,email", ["a:list_contacts!inner(list_id)"])).toBe(
      "id,email,a:list_contacts!inner(list_id)",
    );
  });
});

describe("applyListFilters", () => {
  it("makes no calls when nothing is filtered", () => {
    const q = fakeQuery();
    applyListFilters(q, [], []);
    expect(q.calls).toHaveLength(0);
  });

  it("filters the aliased embed for includes", () => {
    const q = fakeQuery();
    applyListFilters(q, [LIST_A, LIST_B], []);
    expect(q.calls).toEqual([
      { method: "in", args: [`${INCLUDE_ALIAS}.list_id`, [LIST_A, LIST_B]] },
    ]);
  });

  it("scopes the embed then requires it to be null for excludes", () => {
    const q = fakeQuery();
    applyListFilters(q, [], [LIST_A]);
    expect(q.calls).toEqual([
      { method: "in", args: [`${EXCLUDE_ALIAS}.list_id`, [LIST_A]] },
      { method: "is", args: [EXCLUDE_ALIAS, null] },
    ]);
  });

  it("never inlines contact ids into the query — the old URL-blowout path", () => {
    const q = fakeQuery();
    applyListFilters(q, [LIST_A], [LIST_B]);
    // Only list ids are ever passed, never a resolved membership set.
    for (const call of q.calls) {
      const payload = call.args[1];
      if (Array.isArray(payload)) {
        expect(payload.length).toBeLessThanOrEqual(2);
      }
    }
    expect(q.calls.some((c) => c.method === "not")).toBe(false);
  });

  it("sends only list ids regardless of how large the underlying lists are", () => {
    // The whole point: request size is bounded by the number of lists chosen,
    // not by how many contacts those lists contain.
    const q = fakeQuery();
    applyListFilters(q, [LIST_A], [LIST_B]);
    const totalArgs = q.calls.flatMap((c) => (Array.isArray(c.args[1]) ? c.args[1] : []));
    expect(totalArgs).toEqual([LIST_A, LIST_B]);
  });
});
