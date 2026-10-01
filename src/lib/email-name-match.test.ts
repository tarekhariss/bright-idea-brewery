import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEAD_QUALITY_POLICY,
  assessEmailNameMatch,
  decideLeadQuality,
  normalizeLocalPart,
  normalizeName,
  splitFullName,
} from "./email-name-match";

const assess = (firstName: string, lastName: string, email: string) =>
  assessEmailNameMatch({ firstName, lastName, email });

describe("the case that started this", () => {
  it("rejects a contact whose email names someone else entirely", () => {
    const result = assess("John", "Johnstone", "patrickwhite@acme.com");
    expect(result.verdict).toBe("mismatch");
    expect(result.score).toBeLessThan(25);
    expect(decideLeadQuality(result)).toBe("reject");
  });

  it("explains itself in terms a human can act on", () => {
    const result = assess("John", "Johnstone", "patrickwhite@acme.com");
    expect(result.reason).toContain("different person");
  });
});

describe("standard corporate patterns", () => {
  it.each([
    ["john.smith@acme.com", "first.last"],
    ["johnsmith@acme.com", "first.last"],
    ["john_smith@acme.com", "first.last"],
    ["john-smith@acme.com", "first.last"],
    ["jsmith@acme.com", "flast"],
    ["j.smith@acme.com", "flast"],
    ["smithj@acme.com", "lastf"],
    ["smith.john@acme.com", "last.first"],
    ["johns@acme.com", "firstl"],
  ])("accepts %s", (email, pattern) => {
    const result = assess("John", "Smith", email);
    expect(result.verdict).toBe("match");
    expect(result.pattern).toBe(pattern);
    expect(decideLeadQuality(result)).toBe("accept");
  });

  it("accepts a bare first name, with lower confidence", () => {
    const result = assess("John", "Smith", "john@acme.com");
    expect(result.verdict).toBe("match");
    expect(result.score).toBeLessThan(90); // could be any John at the company
  });

  it("accepts a bare last name", () => {
    const result = assess("John", "Smith", "smith@acme.com");
    expect(result.verdict).toBe("match");
  });
});

describe("nicknames — the main source of false rejections", () => {
  it.each([
    ["Robert", "Smith", "bob.smith@acme.com"],
    ["Robert", "Smith", "rob.smith@acme.com"],
    ["William", "Jones", "bill.jones@acme.com"],
    ["Margaret", "Hall", "peggy.hall@acme.com"],
    ["Richard", "Byrne", "dick.byrne@acme.com"],
    ["Elizabeth", "Warren", "liz.warren@acme.com"],
    ["Michael", "Chen", "mike.chen@acme.com"],
    ["Katherine", "Obrien", "kate.obrien@acme.com"],
  ])("accepts %s %s <%s>", (first, last, email) => {
    const result = assess(first, last, email);
    expect(result.verdict).toBe("match");
    expect(decideLeadQuality(result)).toBe("accept");
  });

  it("matches nicknames in both directions", () => {
    expect(assess("Bob", "Smith", "robert.smith@acme.com").verdict).toBe("match");
  });
});

describe("international and awkward names", () => {
  it("strips diacritics before comparing", () => {
    expect(assess("José", "Müller", "jose.muller@acme.com").verdict).toBe("match");
    expect(assess("Renée", "Dupont", "renee.dupont@acme.com").verdict).toBe("match");
  });

  it("handles hyphenated and spaced surnames", () => {
    expect(assess("Mary", "Smith-Jones", "mary.smithjones@acme.com").verdict).toBe("match");
    expect(assess("Piet", "van der Berg", "piet.vanderberg@acme.com").verdict).toBe("match");
  });

  it("tolerates a single-character transliteration slip on longer names", () => {
    const result = assess("Dmitri", "Sokolov", "dmitri.sokolow@acme.com");
    expect(result.verdict).toBe("match");
    expect(result.score).toBeLessThan(100); // confidence reduced, not full
  });

  it("ignores titles and suffixes when splitting a full name", () => {
    expect(splitFullName("Dr. John Smith Jr.")).toEqual({
      firstName: "John",
      lastName: "Smith",
    });
    expect(splitFullName("Smith, John")).toEqual({ firstName: "Smith", lastName: "John" });
  });

  it("falls back to fullName when first and last are absent", () => {
    const result = assessEmailNameMatch({
      fullName: "John Smith",
      email: "john.smith@acme.com",
    });
    expect(result.verdict).toBe("match");
  });
});

describe("email shapes that trip naive matchers", () => {
  it("ignores plus-addressing", () => {
    expect(assess("John", "Smith", "john.smith+crm@acme.com").verdict).toBe("match");
  });

  it("ignores disambiguating trailing digits", () => {
    expect(assess("John", "Smith", "jsmith2@acme.com").verdict).toBe("match");
  });

  it("is case and whitespace insensitive", () => {
    expect(assess("JOHN", "smith", "  John.Smith@ACME.com  ").verdict).toBe("match");
  });

  it("normalises the local part predictably", () => {
    expect(normalizeLocalPart("John.Smith+tag@acme.com")).toBe("john.smith");
    expect(normalizeLocalPart("jsmith99@acme.com")).toBe("jsmith");
  });

  it("normalises names predictably", () => {
    expect(normalizeName("O'Brien-Smith")).toBe("obriensmith");
    expect(normalizeName("José")).toBe("jose");
  });
});

describe("role mailboxes", () => {
  it.each(["info@acme.com", "sales@acme.com", "hr@acme.com", "no-reply@acme.com"])(
    "classifies %s as a role account rather than a mismatch",
    (email) => {
      const result = assess("John", "Smith", email);
      expect(result.verdict).toBe("role_based");
      expect(decideLeadQuality(result)).toBe("review");
    },
  );

  it("catches role prefixes with regional suffixes", () => {
    expect(assess("John", "Smith", "sales.uk@acme.com").verdict).toBe("role_based");
  });

  it("can be configured to accept role accounts", () => {
    const result = assess("John", "Smith", "info@acme.com");
    const policy = { ...DEFAULT_LEAD_QUALITY_POLICY, reviewRoleAccounts: false };
    expect(decideLeadQuality(result, policy)).toBe("accept");
  });

  it("does not mistake a person whose name starts like a role word", () => {
    // "Helen" starts with "hel" but is not "hello"
    expect(assess("Helen", "Parker", "helen.parker@acme.com").verdict).toBe("match");
  });
});

describe("missing data never rejects a lead", () => {
  it("returns unknown when there is no email", () => {
    const result = assess("John", "Smith", "");
    expect(result.verdict).toBe("unknown");
    expect(decideLeadQuality(result)).toBe("accept");
  });

  it("returns unknown when there is no name", () => {
    const result = assess("", "", "jsmith@acme.com");
    expect(result.verdict).toBe("unknown");
    expect(decideLeadQuality(result)).toBe("accept");
  });

  it("returns unknown for a malformed email", () => {
    expect(assess("John", "Smith", "not-an-email").verdict).toBe("unknown");
  });

  it("scores unknown neutrally rather than punitively", () => {
    expect(assess("John", "Smith", "").score).toBe(50);
  });
});

describe("ambiguous cases go to review, not the bin", () => {
  it("flags a matching surname with a wrong first name", () => {
    const result = assess("John", "Smith", "patricia.smith@acme.com");
    expect(result.verdict).toBe("partial");
    expect(decideLeadQuality(result)).toBe("review");
  });

  it("treats short opaque local parts as unverifiable, not wrong", () => {
    const result = assess("John", "Smith", "xk9@acme.com");
    expect(result.verdict).toBe("partial");
    expect(decideLeadQuality(result)).toBe("review");
  });

  it("flags an unrecognised alias for review rather than rejecting it", () => {
    const result = assess("John", "Smith", "jsmith.consulting@acme.com");
    expect(["match", "partial"]).toContain(result.verdict);
    expect(decideLeadQuality(result)).not.toBe("reject");
  });
});

describe("policy thresholds", () => {
  it("rejects only below the reject threshold", () => {
    const strong = assess("John", "Smith", "john.smith@acme.com");
    const weak = assess("John", "Johnstone", "patrickwhite@acme.com");
    expect(decideLeadQuality(strong)).toBe("accept");
    expect(decideLeadQuality(weak)).toBe("reject");
  });

  it("honours a stricter policy", () => {
    const result = assess("John", "Smith", "john@acme.com"); // score 80
    expect(decideLeadQuality(result)).toBe("accept");
    expect(
      decideLeadQuality(result, { ...DEFAULT_LEAD_QUALITY_POLICY, reviewBelow: 90 }),
    ).toBe("review");
  });

  it("honours a permissive policy that rejects nothing", () => {
    const result = assess("John", "Johnstone", "patrickwhite@acme.com");
    expect(
      decideLeadQuality(result, { ...DEFAULT_LEAD_QUALITY_POLICY, rejectBelow: 0 }),
    ).not.toBe("reject");
  });
});

describe("non-Western name orders and compound names", () => {
  it("does not reject a Vietnamese given-name-last address", () => {
    // Nguyen Van Minh <minhnv@> — given name plus initials of the rest.
    const result = assess("Nguyen", "Van Minh", "minhnv@viet.vn");
    expect(result.verdict).toBe("partial");
    expect(decideLeadQuality(result)).toBe("review");
  });

  it("matches a Spanish double surname on either part", () => {
    expect(assess("Carlos", "Garcia Perez", "cgarcia@es.com").verdict).not.toBe("mismatch");
    expect(assess("Carlos", "Garcia Perez", "carlos.perez@es.com").verdict).toBe("match");
  });

  it("matches an Arabic name with a particle", () => {
    expect(assess("Ahmed", "Al-Rashid", "ahmed.alrashid@gulf.ae").verdict).toBe("match");
    expect(assess("Ahmed", "Al-Rashid", "a.rashid@gulf.ae").verdict).not.toBe("mismatch");
  });

  it("matches a French compound given name", () => {
    expect(assess("Jean-Pierre", "Dubois", "jp.dubois@corp.fr").verdict).not.toBe("mismatch");
  });
});

describe("aliases with extra segments", () => {
  it("reviews rather than rejects initials plus a suffix", () => {
    const result = assess("John", "Smith", "js.consulting@acme.com");
    expect(result.verdict).toBe("partial");
    expect(decideLeadQuality(result)).toBe("review");
  });

  it("still rejects when no segment relates to the name", () => {
    const result = assess("Maria", "Garcia", "johnwilliams@acme.com");
    expect(result.verdict).toBe("mismatch");
    expect(decideLeadQuality(result)).toBe("reject");
  });
});

