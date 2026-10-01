import { describe, expect, it } from "vitest";
import { buildOrSearch, pgrstPattern, pgrstValue } from "./postgrest-filter";

describe("pgrstValue", () => {
  it("leaves simple strings unquoted so URLs stay readable", () => {
    expect(pgrstValue("acme")).toBe("acme");
    expect(pgrstValue("Engineering")).toBe("Engineering");
  });

  it("emits numbers and booleans bare so numeric columns compare numerically", () => {
    expect(pgrstValue(42)).toBe("42");
    expect(pgrstValue(0)).toBe("0");
    expect(pgrstValue(true)).toBe("true");
  });

  it("quotes values containing a comma — the condition separator", () => {
    expect(pgrstValue("Smith, John")).toBe('"Smith, John"');
  });

  it("quotes values containing a dot — the field/operator separator", () => {
    expect(pgrstValue("Dept. of Energy")).toBe('"Dept. of Energy"');
  });

  it("quotes values containing parentheses — the group delimiters", () => {
    expect(pgrstValue("Acme (UK)")).toBe('"Acme (UK)"');
  });

  it("escapes embedded double quotes and backslashes", () => {
    expect(pgrstValue('say "hi"')).toBe('"say \\"hi\\""');
    expect(pgrstValue("back\\slash")).toBe('"back\\\\slash"');
  });

  it("represents an empty string as empty quotes, not a bare gap", () => {
    expect(pgrstValue("")).toBe('""');
  });

  it("maps null and undefined to the null literal", () => {
    expect(pgrstValue(null)).toBe("null");
    expect(pgrstValue(undefined)).toBe("null");
  });

  it("neutralises an injected condition", () => {
    // Previously this appended a real second condition to the filter.
    const injected = "a,email.neq.null";
    expect(pgrstValue(injected)).toBe('"a,email.neq.null"');
  });
});

describe("pgrstPattern", () => {
  it("wraps a contains pattern in PostgREST wildcards", () => {
    expect(pgrstPattern("acme")).toBe('"*acme*"');
  });

  it("anchors starts_with and ends_with correctly", () => {
    expect(pgrstPattern("acme", "starts_with")).toBe('"acme*"');
    expect(pgrstPattern("acme", "ends_with")).toBe('"*acme"');
  });

  it("keeps punctuation inside the quoted pattern", () => {
    expect(pgrstPattern("Smith, John")).toBe('"*Smith, John*"');
  });

  it("quotes even simple terms, since free text usually has spaces", () => {
    expect(pgrstPattern("john smith")).toBe('"*john smith*"');
  });
});

describe("buildOrSearch", () => {
  it("builds one ilike clause per column", () => {
    expect(buildOrSearch(["first_name", "last_name"], "smith")).toBe(
      'first_name.ilike."*smith*",last_name.ilike."*smith*"',
    );
  });

  it("returns null for empty or whitespace-only terms so callers can skip", () => {
    expect(buildOrSearch(["name"], "")).toBeNull();
    expect(buildOrSearch(["name"], "   ")).toBeNull();
  });

  it("trims the term", () => {
    expect(buildOrSearch(["name"], "  acme  ")).toBe('name.ilike."*acme*"');
  });

  it("keeps a comma-bearing term as a single condition per column", () => {
    const result = buildOrSearch(["first_name", "last_name"], "Smith, John");
    expect(result).toBe(
      'first_name.ilike."*Smith, John*",last_name.ilike."*Smith, John*"',
    );
    // Two columns means exactly two conditions — the comma in the term must not
    // have created a third.
    const conditions = result!.split(/,(?=[a-z_]+\.)/);
    expect(conditions).toHaveLength(2);
  });
});
