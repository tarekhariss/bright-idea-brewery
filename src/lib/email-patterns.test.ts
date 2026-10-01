import { describe, expect, it } from "vitest";
import {
  addObservation,
  createEvidence,
  finalizeDomainPattern,
  PATTERN_TEMPLATES,
  generateCandidates,
  inferPatterns,
  learnDomainPattern,
  renderPattern,
  type EmailPattern,
  type PatternObservation,
} from "./email-patterns";

const obs = (
  email: string,
  firstName: string,
  lastName: string,
  extra: Partial<PatternObservation> = {},
): PatternObservation => ({ email, firstName, lastName, status: "valid", ...extra });

describe("render and infer are two directions of one thing", () => {
  it("every template inference reports would reproduce the address exactly", () => {
    // The property that keeps the two directions from drifting apart. If this
    // ever fails, generation is emitting addresses inference cannot recognise,
    // and the engine silently stops learning from its own output.
    const people = [
      ["John", "Smith"], ["Ahmed", "Al-Rashid"], ["Mary", "O'Brien"],
      ["Jean", "Dupont"], ["Li", "Wei"], ["Bilal", "Khan"],
    ];
    for (const [first, last] of people) {
      for (const template of PATTERN_TEMPLATES) {
        const local = renderPattern(template.id, first.toLowerCase(), last.toLowerCase().replace(/[^a-z-]/g, ""));
        if (!local) continue;
        const result = inferPatterns({ email: `${local}@acme.com`, firstName: first, lastName: last });
        expect(result.patterns, `${first} ${last} / ${template.id} → ${local}`).toContain(template.id);
      }
    }
  });

  it("renders nothing when the name lacks a part the template needs", () => {
    // "john." is not an address; emitting it would poison both directions.
    expect(renderPattern("first.last", "john", "")).toBeNull();
    expect(renderPattern("flast", "", "smith")).toBeNull();
    expect(renderPattern("first", "john", "")).toBe("john");
  });
});

describe("inference identifies the shape that produced an address", () => {
  it.each<[string, string, string, EmailPattern]>([
    ["john.smith@acme.com", "John", "Smith", "first.last"],
    ["johnsmith@acme.com", "John", "Smith", "firstlast"],
    ["jsmith@acme.com", "John", "Smith", "flast"],
    ["j.smith@acme.com", "John", "Smith", "f.last"],
    ["john_smith@acme.com", "John", "Smith", "first_last"],
    ["john-smith@acme.com", "John", "Smith", "first-last"],
    ["smith.john@acme.com", "John", "Smith", "last.first"],
    ["smithj@acme.com", "John", "Smith", "lastf"],
    ["johns@acme.com", "John", "Smith", "firstl"],
    ["john@acme.com", "John", "Smith", "first"],
  ])("%s for %s %s → %s", (email, firstName, lastName, pattern) => {
    expect(inferPatterns({ email, firstName, lastName }).patterns).toContain(pattern);
  });

  it("reports every matching template rather than picking one", () => {
    // "J Smith" with j.smith@ is genuinely both shapes. Choosing here would
    // invent certainty the domain aggregate is better placed to resolve.
    const result = inferPatterns({ email: "j.smith@acme.com", firstName: "J", lastName: "Smith" });
    expect(result.patterns).toContain("first.last");
    expect(result.patterns).toContain("f.last");
  });

  it("ignores plus-addressing and disambiguating digits", () => {
    expect(inferPatterns({ email: "john.smith+crm@acme.com", firstName: "John", lastName: "Smith" }).patterns)
      .toContain("first.last");
    // jsmith2 is the second J Smith; the company pattern is still flast.
    expect(inferPatterns({ email: "jsmith2@acme.com", firstName: "John", lastName: "Smith" }).patterns)
      .toContain("flast");
  });

  it("matches a nickname and says so", () => {
    const result = inferPatterns({ email: "bob.smith@acme.com", firstName: "Robert", lastName: "Smith" });
    expect(result.patterns).toContain("first.last");
    expect(result.usedNickname).toBe(true);
  });

  it("does not flag a nickname when the given name matched", () => {
    expect(inferPatterns({ email: "robert.smith@acme.com", firstName: "Robert", lastName: "Smith" }).usedNickname)
      .toBe(false);
  });

  it("finds no pattern when the address names someone else", () => {
    expect(inferPatterns({ email: "patrickwhite@acme.com", firstName: "John", lastName: "Smith" }).patterns)
      .toEqual([]);
  });

  it("falls back to splitting a full name", () => {
    expect(inferPatterns({ email: "john.smith@acme.com", fullName: "John Smith" }).patterns)
      .toContain("first.last");
  });
});

describe("non-Western and compound surnames", () => {
  it("matches an Arabic surname written three different ways", () => {
    for (const email of ["ahmed.alrashid@x.com", "ahmed.al-rashid@x.com", "ahmed.rashid@x.com"]) {
      expect(inferPatterns({ email, firstName: "Ahmed", lastName: "Al-Rashid" }).patterns)
        .toContain("first.last");
    }
  });

  it("matches a Dutch particle surname with and without the particle", () => {
    for (const email of ["jan.vandenberg@x.com", "jan.berg@x.com"]) {
      expect(inferPatterns({ email, firstName: "Jan", lastName: "van den Berg" }).patterns)
        .toContain("first.last");
    }
  });

  it("strips diacritics on both sides", () => {
    expect(inferPatterns({ email: "jose.garcia@x.com", firstName: "José", lastName: "García" }).patterns)
      .toContain("first.last");
  });

  it("handles an apostrophe surname", () => {
    expect(inferPatterns({ email: "mary.obrien@x.com", firstName: "Mary", lastName: "O'Brien" }).patterns)
      .toContain("first.last");
  });
});

describe("learning a domain pattern", () => {
  it("learns from agreeing confirmed addresses", () => {
    const profile = learnDomainPattern("acme.com", [
      obs("john.smith@acme.com", "John", "Smith"),
      obs("mary.jones@acme.com", "Mary", "Jones"),
      obs("ahmed.khan@acme.com", "Ahmed", "Khan"),
    ]);
    expect(profile.pattern).toBe("first.last");
    expect(profile.verdict).toBe("learned");
    expect(profile.confidence).toBeGreaterThan(80);
    expect(profile.confirmedObservations).toBe(3);
  });

  it("is modest on a single observation", () => {
    // One confirmed address is real evidence but not a proven convention.
    const profile = learnDomainPattern("acme.com", [obs("john.smith@acme.com", "John", "Smith")]);
    expect(profile.pattern).toBe("first.last");
    expect(profile.confidence).toBeGreaterThan(40);
    expect(profile.confidence).toBeLessThan(75);
  });

  it("reports ambiguous when a domain genuinely uses two shapes", () => {
    const profile = learnDomainPattern("acme.com", [
      obs("john.smith@acme.com", "John", "Smith"),
      obs("mjones@acme.com", "Mary", "Jones"),
    ]);
    expect(profile.verdict).toBe("ambiguous");
    expect(profile.runnerUp).not.toBeNull();
    expect(profile.confidence).toBeLessThan(60);
  });

  it("returns no pattern rather than guessing when nothing resolves", () => {
    const profile = learnDomainPattern("acme.com", [obs("xq7z@acme.com", "John", "Smith")]);
    expect(profile.pattern).toBeNull();
    expect(profile.verdict).toBe("insufficient_evidence");
  });

  it("returns no pattern for an empty domain", () => {
    expect(learnDomainPattern("acme.com", []).verdict).toBe("insufficient_evidence");
  });
});

/** Distinct people at one company, all addressed `first.last`. */
const STAFF: Array<[string, string]> = [
  ["John", "Smith"], ["Mary", "Jones"], ["Ahmed", "Khan"], ["Fatima", "Hassan"],
  ["Peter", "Lang"], ["Sara", "Nabil"], ["Omar", "Farouk"], ["Lena", "Vogel"],
  ["Diego", "Ramos"], ["Aisha", "Noor"],
];

const staffRows = (
  count: number,
  extra: Partial<PatternObservation>,
): PatternObservation[] =>
  STAFF.slice(0, count).map(([first, last]) =>
    obs(`${first.toLowerCase()}.${last.toLowerCase()}@acme.com`, first, last, extra),
  );

describe("evidence quality decides confidence, not row count", () => {
  it("caps a domain where nothing was ever verified", () => {
    // Ten unverified rows record what a vendor guessed. Reporting 80%
    // confidence from that would launder their guess into our own number.
    const profile = learnDomainPattern("acme.com", staffRows(10, { status: "unverified" }));
    expect(profile.pattern).toBe("first.last");
    expect(profile.observations).toBe(10);
    expect(profile.confidence).toBeLessThanOrEqual(50);
    expect(profile.reason).toContain("never confirmed deliverable");
  });

  it("caps a catch-all domain however much evidence it has", () => {
    // A catch-all accepts asdfgh@ too, so acceptance proves nothing.
    const profile = learnDomainPattern(
      "acme.com",
      staffRows(8, { status: "valid_catch_all", isCatchAll: true }),
    );
    expect(profile.pattern).toBe("first.last");
    expect(profile.isCatchAll).toBe(true);
    expect(profile.confidence).toBeLessThanOrEqual(60);
    expect(profile.reason).toContain("catch-all");
  });

  it("never reports certainty, however unanimous the evidence", () => {
    // A flat 100 would invite a caller to skip verification on exactly the
    // domains it felt safest about — and any company can have an exception.
    const profile = learnDomainPattern("acme.com", staffRows(10, { status: "valid" }));
    expect(profile.confidence).toBe(99);
  });

  it("does not cap a confirmed non-catch-all domain", () => {
    // The ceilings must not quietly apply to the good case.
    const profile = learnDomainPattern("acme.com", staffRows(5, { status: "valid" }));
    expect(profile.confidence).toBeGreaterThan(60);
    expect(profile.reason).not.toContain("capped");
  });

  it("ranks a confirmed pattern above an unverified one with more rows", () => {
    const profile = learnDomainPattern("acme.com", [
      obs("john.smith@acme.com", "John", "Smith", { status: "valid" }),
      obs("ajones@acme.com", "Amy", "Jones", { status: "unverified" }),
      obs("bkhan@acme.com", "Bilal", "Khan", { status: "unverified" }),
      obs("cpatel@acme.com", "Chetan", "Patel", { status: "unverified" }),
    ]);
    // Three guesses do not outweigh one proven delivery.
    expect(profile.pattern).toBe("first.last");
  });

  it("counts a suppression as proof the mailbox exists", () => {
    // Someone unsubscribed, which means a human received it.
    const profile = learnDomainPattern("acme.com", [
      obs("john.smith@acme.com", "John", "Smith", { status: "suppressed" }),
      obs("mary.jones@acme.com", "Mary", "Jones", { status: "suppressed" }),
    ]);
    expect(profile.confirmedObservations).toBe(2);
    expect(profile.reason).not.toContain("never confirmed");
  });
});

describe("bounces unlearn a wrong pattern", () => {
  it("counts a bounce as evidence against the shape that produced it", () => {
    const profile = learnDomainPattern("acme.com", [
      obs("john.smith@acme.com", "John", "Smith", { status: "bounced" }),
      obs("mary.jones@acme.com", "Mary", "Jones", { status: "bounced" }),
      obs("akhan@acme.com", "Ahmed", "Khan", { status: "valid" }),
    ]);
    // first.last is bounced twice here; flast delivered.
    expect(profile.pattern).toBe("flast");
  });

  it("refuses to pick a winner when everything at the domain bounced", () => {
    const profile = learnDomainPattern("acme.com", [
      obs("john.smith@acme.com", "John", "Smith", { status: "bounced" }),
      obs("mary.jones@acme.com", "Mary", "Jones", { status: "invalid" }),
    ]);
    expect(profile.pattern).toBeNull();
    expect(profile.verdict).toBe("insufficient_evidence");
  });

  it("surfaces evidence against the winner in the reason", () => {
    const profile = learnDomainPattern("acme.com", [
      obs("a.one@acme.com", "A", "One", { status: "valid" }),
      obs("b.two@acme.com", "B", "Two", { status: "valid" }),
      obs("c.three@acme.com", "C", "Three", { status: "valid" }),
      obs("d.four@acme.com", "D", "Four", { status: "bounced" }),
    ]);
    expect(profile.reason).toContain("evidence against");
  });
});

describe("exclusions", () => {
  it("never learns a pattern for a free-mail host", () => {
    const profile = learnDomainPattern("gmail.com", [
      obs("john.smith@gmail.com", "John", "Smith"),
      obs("mary.jones@gmail.com", "Mary", "Jones"),
    ]);
    expect(profile.verdict).toBe("not_applicable");
    expect(profile.pattern).toBeNull();
  });

  it("ignores role mailboxes and says how many it skipped", () => {
    const profile = learnDomainPattern("acme.com", [
      obs("info@acme.com", "Info", "Desk", { isRoleBased: true }),
      obs("sales@acme.com", "Sales", "Team", { isRoleBased: true }),
    ]);
    expect(profile.verdict).toBe("insufficient_evidence");
    expect(profile.reason).toContain("role mailbox");
  });

  it("still learns from personal addresses alongside role ones", () => {
    const profile = learnDomainPattern("acme.com", [
      obs("info@acme.com", "Info", "Desk", { isRoleBased: true }),
      obs("john.smith@acme.com", "John", "Smith"),
      obs("mary.jones@acme.com", "Mary", "Jones"),
    ]);
    expect(profile.pattern).toBe("first.last");
    expect(profile.observations).toBe(2);
  });

  it("drops a free-mail address that slipped onto a company domain group", () => {
    const profile = learnDomainPattern("acme.com", [
      obs("jsmith@gmail.com", "John", "Smith", { isFreeEmail: true }),
      obs("mary.jones@acme.com", "Mary", "Jones"),
    ]);
    expect(profile.observations).toBe(1);
  });
});

describe("ambiguous observations carry less weight than unambiguous ones", () => {
  it("lets an unambiguous address outweigh an ambiguous one", () => {
    // "J Smith / j.smith@" matches first.last and f.last equally, so it cannot
    // settle the domain on its own. One clear first.last should.
    const profile = learnDomainPattern("acme.com", [
      obs("j.smith@acme.com", "J", "Smith"),
      obs("mary.jones@acme.com", "Mary", "Jones"),
    ]);
    expect(profile.pattern).toBe("first.last");
  });
});

describe("the streaming accumulator and the batch helper agree", () => {
  it("produces an identical profile either way", () => {
    // The miner folds ~1.2M contacts in arbitrary order via the accumulator,
    // while the tests and any batch caller use learnDomainPattern. If these two
    // paths could differ, the mined table would not match what anyone can
    // reproduce locally.
    const rows = [
      obs("john.smith@acme.com", "John", "Smith", { status: "valid" }),
      obs("mary.jones@acme.com", "Mary", "Jones", { status: "unverified" }),
      obs("info@acme.com", "Info", "Desk", { isRoleBased: true }),
      obs("akhan@acme.com", "Ahmed", "Khan", { status: "bounced" }),
      obs("j.lang@acme.com", "J", "Lang", { status: "valid" }),
    ];

    const evidence = createEvidence();
    for (const row of rows) addObservation(evidence, row);

    expect(finalizeDomainPattern("acme.com", evidence)).toEqual(
      learnDomainPattern("acme.com", rows),
    );
  });

  it("is order-independent, so the miner need not sort its input", () => {
    const rows = [
      obs("john.smith@acme.com", "John", "Smith", { status: "valid" }),
      obs("mjones@acme.com", "Mary", "Jones", { status: "unverified" }),
      obs("ahmed.khan@acme.com", "Ahmed", "Khan", { status: "valid" }),
    ];
    expect(learnDomainPattern("acme.com", [...rows].reverse()))
      .toEqual(learnDomainPattern("acme.com", rows));
  });
});

describe("generating candidates to verify", () => {
  const learned = learnDomainPattern("acme.com", [
    obs("john.smith@acme.com", "John", "Smith"),
    obs("mary.jones@acme.com", "Mary", "Jones"),
    obs("ahmed.khan@acme.com", "Ahmed", "Khan"),
  ]);

  it("puts the learned pattern first", () => {
    const candidates = generateCandidates({
      firstName: "Fatima", lastName: "Hassan", domain: "acme.com", profile: learned,
    });
    expect(candidates[0].email).toBe("fatima.hassan@acme.com");
    expect(candidates[0].basis).toBe("learned");
    expect(candidates[0].confidence).toBe(learned.confidence);
  });

  it("falls back to global frequency with no profile", () => {
    const candidates = generateCandidates({ firstName: "Fatima", lastName: "Hassan", domain: "acme.com" });
    expect(candidates[0].email).toBe("fatima.hassan@acme.com");
    expect(candidates[0].basis).toBe("prior");
    expect(candidates.map((c) => c.email)).toContain("fhassan@acme.com");
  });

  it("never reports a guess as confidently as a learned pattern", () => {
    const candidates = generateCandidates({ firstName: "Fatima", lastName: "Hassan", domain: "acme.com" });
    for (const candidate of candidates) {
      expect(candidate.basis).toBe("prior");
      expect(candidate.confidence).toBeLessThanOrEqual(34);
    }
  });

  it("respects the limit, because each candidate costs a verification credit", () => {
    expect(generateCandidates(
      { firstName: "Fatima", lastName: "Hassan", domain: "acme.com" },
      { limit: 3 },
    )).toHaveLength(3);
  });

  it("emits no duplicates", () => {
    const emails = generateCandidates(
      { firstName: "Ahmed", lastName: "Al-Rashid", domain: "acme.com" },
      { limit: 20 },
    ).map((c) => c.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it("offers every spelling of a compound surname", () => {
    const emails = generateCandidates(
      { firstName: "Ahmed", lastName: "Al-Rashid", domain: "acme.com", profile: null },
      { limit: 20 },
    ).map((c) => c.email);
    expect(emails).toContain("ahmed.alrashid@acme.com");
    expect(emails).toContain("ahmed.rashid@acme.com");
  });

  it("refuses to generate for a free-mail host", () => {
    expect(generateCandidates({ firstName: "John", lastName: "Smith", domain: "gmail.com" })).toEqual([]);
  });

  it("returns nothing without a usable name", () => {
    expect(generateCandidates({ firstName: "", lastName: "", domain: "acme.com" })).toEqual([]);
  });

  it("works from a full name alone", () => {
    const candidates = generateCandidates({ fullName: "Fatima Hassan", domain: "acme.com", profile: learned });
    expect(candidates[0].email).toBe("fatima.hassan@acme.com");
  });

  it("strips a leading @ from the domain", () => {
    expect(generateCandidates({ firstName: "John", lastName: "Smith", domain: "@acme.com" })[0].email)
      .toBe("john.smith@acme.com");
  });

  it("leaves nicknames out unless asked", () => {
    const without = generateCandidates(
      { firstName: "Robert", lastName: "Smith", domain: "acme.com" }, { limit: 20 },
    ).map((c) => c.email);
    expect(without).not.toContain("bob.smith@acme.com");

    const with_ = generateCandidates(
      { firstName: "Robert", lastName: "Smith", domain: "acme.com" },
      { limit: 40, includeNicknames: true },
    );
    expect(with_.map((c) => c.email)).toContain("bob.smith@acme.com");
    expect(with_.find((c) => c.email === "bob.smith@acme.com")?.usedNickname).toBe(true);
  });

  it("generates an address inference then recognises", () => {
    // Closes the loop: what we generate and verify can be fed back as evidence.
    const candidate = generateCandidates({
      firstName: "Fatima", lastName: "Hassan", domain: "acme.com", profile: learned,
    })[0];
    const back = inferPatterns({ email: candidate.email, firstName: "Fatima", lastName: "Hassan" });
    expect(back.patterns).toContain(candidate.pattern);
  });
});
