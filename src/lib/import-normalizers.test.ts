import { describe, expect, it } from "vitest";
import {
  companyDomainKey,
  companyNameKey,
  deriveRowDomain,
  isEmptyLike,
  normalizeCompanyName,
  normalizeDomain,
  normalizeEmail,
  normalizeLinkedIn,
  normalizePhone,
  normalizeWebsite,
  titleCase,
} from "./import-normalizers";

/**
 * Stand-ins for the SQL generated columns, so the divergences that caused real
 * dedup failures are pinned here rather than discovered in production again.
 */
const sql = {
  /** contacts.normalized_email */
  normalizedEmail: (email: string) => email.replace(/\s/g, "").toLowerCase() || null,
  /** companies.normalized_domain */
  normalizedDomain: (domain: string) => domain.toLowerCase(),
  /** companies.normalized_name */
  normalizedName: (name: string) => name.trim().toLowerCase(),
  /** contacts.normalized_linkedin_url */
  normalizedLinkedIn: (url: string) =>
    url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[/?#].*$/, "") || null,
};

describe("isEmptyLike", () => {
  it.each(["", "  ", "n/a", "N/A", "null", "NONE", "-", "--", "not available", "#N/A"])(
    "treats %s as empty",
    (value) => expect(isEmptyLike(value)).toBe(true),
  );

  it("does not swallow real values", () => {
    expect(isEmptyLike("Acme")).toBe(false);
    expect(isEmptyLike("0")).toBe(false);
    expect(isEmptyLike("nan")).toBe(false); // a surname, not a null marker
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  John.Smith@Acme.COM ")).toBe("john.smith@acme.com");
  });

  it("strips a mailto: prefix and zero-width characters", () => {
    expect(normalizeEmail("mailto:john@acme.com")).toBe("john@acme.com");
    expect(normalizeEmail("john​@acme.com")).toBe("john@acme.com");
  });

  it("agrees with the SQL column for values written through it", () => {
    const value = normalizeEmail("  John.Smith@Acme.COM ");
    expect(sql.normalizedEmail(value)).toBe(value);
  });

  it("DIVERGES from SQL for a raw mailto: value — the column keeps the prefix", () => {
    // Documented, not a defect: rows written by other code paths may carry it.
    expect(sql.normalizedEmail("mailto:john@acme.com")).toBe("mailto:john@acme.com");
    expect(normalizeEmail("mailto:john@acme.com")).toBe("john@acme.com");
  });
});

describe("normalizeDomain", () => {
  it("strips scheme, www and path", () => {
    expect(normalizeDomain("https://www.acme.com/about")).toBe("acme.com");
    expect(normalizeDomain("HTTP://Acme.com")).toBe("acme.com");
    expect(normalizeDomain("acme.com?utm=x")).toBe("acme.com");
  });

  it("DIVERGES from companies.normalized_domain, which only lowercases", () => {
    // This is the mismatch that caused duplicate companies: the column stored
    // "www.acme.com" while every lookup asked for "acme.com".
    expect(sql.normalizedDomain("www.acme.com")).toBe("www.acme.com");
    expect(normalizeDomain("www.acme.com")).toBe("acme.com");
    expect(sql.normalizedDomain("www.acme.com")).not.toBe(normalizeDomain("www.acme.com"));
  });
});

describe("companyDomainKey — the fix for that divergence", () => {
  it("yields the same key whichever field or spelling the row holds", () => {
    const expected = "acme.com";
    expect(companyDomainKey({ normalized_domain: "www.acme.com" })).toBe(expected);
    expect(companyDomainKey({ normalized_domain: "acme.com" })).toBe(expected);
    expect(companyDomainKey({ domain: "https://www.acme.com/" })).toBe(expected);
    expect(companyDomainKey({ website: "https://acme.com/careers" })).toBe(expected);
  });

  it("prefers the normalized column, then domain, then website", () => {
    expect(companyDomainKey({ normalized_domain: "a.com", domain: "b.com", website: "c.com" })).toBe("a.com");
    expect(companyDomainKey({ normalized_domain: "  ", domain: "b.com" })).toBe("b.com");
  });

  it("returns empty when there is nothing to key on", () => {
    expect(companyDomainKey({})).toBe("");
    expect(companyDomainKey({ normalized_domain: null, domain: null, website: null })).toBe("");
  });
});

describe("normalizeCompanyName", () => {
  it.each([
    ["Acme Inc", "acme"],
    ["Acme Inc.", "acme"],
    ["Acme, LLC", "acme"],
    ["Acme Ltd.", "acme"],
    ["Acme GmbH", "acme"],
    ["Acme Corporation", "acme"],
    ["Acme Pty Ltd", "acme"],
    ["Acme   Holdings", "acme holdings"],
  ])("reduces %s to %s", (input, expected) => {
    expect(normalizeCompanyName(input)).toBe(expected);
  });

  it("only strips a suffix at the end, not mid-name", () => {
    expect(normalizeCompanyName("Incredible Systems")).toBe("incredible systems");
    expect(normalizeCompanyName("Corporate Express")).toBe("corporate express");
  });

  it("DIVERGES from companies.normalized_name, which keeps the suffix", () => {
    // The mismatch that stopped companies with legal suffixes ever deduping.
    expect(sql.normalizedName("Acme Inc")).toBe("acme inc");
    expect(normalizeCompanyName("Acme Inc")).toBe("acme");
  });
});

describe("companyNameKey — the fix for that divergence", () => {
  it("collapses the stored and suffixed spellings to one key", () => {
    expect(companyNameKey({ normalized_name: "acme inc" })).toBe("acme");
    expect(companyNameKey({ name: "Acme Inc." })).toBe("acme");
    expect(companyNameKey({ normalized_name: "acme" })).toBe("acme");
  });

  it("returns empty rather than a blank key", () => {
    expect(companyNameKey({})).toBe("");
  });
});

describe("normalizeLinkedIn", () => {
  it("canonicalises to a full profile URL", () => {
    expect(normalizeLinkedIn("linkedin.com/in/johnsmith")).toBe("https://www.linkedin.com/in/johnsmith");
    expect(normalizeLinkedIn("https://WWW.LinkedIn.com/in/johnsmith/")).toBe("https://www.linkedin.com/in/johnsmith");
    expect(normalizeLinkedIn("https://linkedin.com/in/johnsmith?trk=x")).toBe("https://www.linkedin.com/in/johnsmith");
  });

  it("treats a bare handle as a profile slug", () => {
    expect(normalizeLinkedIn("johnsmith")).toBe("https://www.linkedin.com/in/johnsmith");
  });

  it("keeps distinct profiles distinct", () => {
    expect(normalizeLinkedIn("linkedin.com/in/johnsmith")).not.toBe(
      normalizeLinkedIn("linkedin.com/in/janesmith"),
    );
  });

  it("proves contacts.normalized_linkedin_url cannot identify anyone", () => {
    // The generated column strips everything after the first slash, so every
    // row collapses to the bare host. Never key on it.
    expect(sql.normalizedLinkedIn("https://www.linkedin.com/in/johnsmith")).toBe("linkedin.com");
    expect(sql.normalizedLinkedIn("https://www.linkedin.com/in/janesmith")).toBe("linkedin.com");
    expect(sql.normalizedLinkedIn("https://www.linkedin.com/in/johnsmith")).toBe(
      sql.normalizedLinkedIn("https://www.linkedin.com/in/janesmith"),
    );
  });
});

describe("normalizePhone", () => {
  it("reduces to digits", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("5551234567");
    expect(normalizePhone("555.123.4567 ext 9")).toBe("55512345679");
  });

  it("preserves a leading plus so country codes survive", () => {
    expect(normalizePhone("+44 20 7123 4567")).toBe("+442071234567");
    expect(normalizePhone("+1 (555) 123-4567")).toBe("+15551234567");
  });
});

describe("normalizeWebsite", () => {
  it("adds a scheme and drops trailing slashes", () => {
    expect(normalizeWebsite("acme.com/")).toBe("https://acme.com");
    expect(normalizeWebsite("http://acme.com//")).toBe("http://acme.com");
  });
});

describe("titleCase", () => {
  it("normalises casing and whitespace", () => {
    expect(titleCase("  jOHN   smith ")).toBe("John Smith");
    expect(titleCase("ACME CORP")).toBe("Acme Corp");
  });
});

describe("deriveRowDomain", () => {
  it("prefers an explicit domain, then website", () => {
    expect(deriveRowDomain({ domain: "acme.com", website: "other.com" })).toBe("acme.com");
    expect(deriveRowDomain({ website: "https://www.acme.com/x" })).toBe("acme.com");
  });

  it("falls back to the email host", () => {
    expect(deriveRowDomain({ email: "john@acme.com" })).toBe("acme.com");
  });

  it("refuses free-mail hosts, which say nothing about an employer", () => {
    // Matching on these would merge unrelated people into one company.
    for (const host of ["gmail.com", "yahoo.com", "outlook.com", "proton.me"]) {
      expect(deriveRowDomain({ email: `john@${host}` })).toBe("");
    }
  });

  it("ignores values that are not domains", () => {
    expect(deriveRowDomain({ domain: "not a domain" })).toBe("");
    expect(deriveRowDomain({ email: "malformed" })).toBe("");
    expect(deriveRowDomain({})).toBe("");
  });
});
