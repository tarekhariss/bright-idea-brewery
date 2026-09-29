import { describe, expect, it } from "vitest";
import {
  SENIORITY_RANK,
  expandTitleQuery,
  normalizeTitle,
  prepareTitle,
} from "./title-ontology";

const t = (raw: string) => normalizeTitle(raw);

describe("the case that makes title search work", () => {
  it("CEO and its long forms all land in the same band", () => {
    for (const raw of [
      "CEO", "ceo", "C.E.O.", "Chief Executive Officer",
      "Group CEO", "CEO & Founder", "Acting CEO", "CEO, MENA",
    ]) {
      expect(t(raw).seniority === "c_suite" || t(raw).seniority === "founder").toBe(true);
    }
  });

  it("searching CEO resolves to a filterable band, not a string", () => {
    const q = expandTitleQuery("CEO");
    expect(q.seniority).toBe("c_suite");
    expect(q.department).toBe("executive");
  });
});

describe("Gulf titles rank where they actually sit", () => {
  it("treats General Manager and Managing Director as C-suite", () => {
    // In Saudi/UAE/Qatar these usually head a country operation. Ranking them
    // as middle management hides the real decision maker.
    expect(t("General Manager").seniority).toBe("c_suite");
    expect(t("GM").seniority).toBe("c_suite");
    expect(t("Managing Director").seniority).toBe("c_suite");
    expect(t("MD").seniority).toBe("c_suite");
  });

  it("recognises country-level leadership", () => {
    expect(t("Country Manager").seniority).toBe("c_suite");
    expect(t("Country Head - KSA").seniority).toBe("c_suite");
  });

  it("recognises owner-operator titles in an SME market", () => {
    for (const raw of ["Owner", "Proprietor", "Partner", "Managing Partner", "Co-Founder"]) {
      expect(t(raw).seniority).toBe("founder");
    }
  });

  it("ranks board roles highest", () => {
    expect(t("Chairman").seniority).toBe("board");
    expect(t("Board Member").seniority).toBe("board");
    expect(t("Non-Executive Director").seniority).toBe("board");
  });
});

describe("the highest band wins on combined titles", () => {
  it("Founder & CEO is a founder", () => {
    expect(t("Founder & CEO").seniority).toBe("founder");
  });

  it("Managing Director and Head of Sales is C-suite, not head", () => {
    const r = t("Managing Director and Head of Sales");
    expect(r.seniority).toBe("c_suite");
    expect(SENIORITY_RANK[r.seniority]).toBeGreaterThan(SENIORITY_RANK.head);
  });

  it("Chairman & CEO is board", () => {
    expect(t("Chairman & CEO").seniority).toBe("board");
  });
});

describe("bands that are easy to get backwards", () => {
  it("Senior Manager is a manager, not an IC senior", () => {
    expect(t("Senior Manager").seniority).toBe("manager");
  });

  it("Senior Software Engineer is an IC senior, not a manager", () => {
    const r = t("Senior Software Engineer");
    expect(r.seniority).toBe("senior");
    expect(r.department).toBe("engineering");
  });

  it("Chief of Staff is not a C-suite officer", () => {
    // Real role, but not an officer — matching "chief" blindly inflates it.
    expect(t("Chief of Staff").seniority).not.toBe("c_suite");
  });

  it("VP variants share the VP band", () => {
    for (const raw of ["VP", "Vice President", "SVP", "EVP", "Senior Vice President"]) {
      expect(t(raw).seniority).toBe("vp");
    }
  });

  it("Head of X sits below Director", () => {
    expect(SENIORITY_RANK[t("Head of Marketing").seniority])
      .toBeLessThan(SENIORITY_RANK[t("Director of Marketing").seniority]);
  });
});

describe("departments", () => {
  it.each([
    ["Chief Financial Officer", "finance"],
    ["Finance Manager", "finance"],
    ["VP of Sales", "sales"],
    ["Business Development Manager", "sales"],
    ["Head of Marketing", "marketing"],
    ["HR Director", "hr"],
    ["Talent Acquisition Specialist", "hr"],
    ["Procurement Manager", "procurement"],
    ["Supply Chain Director", "supply_chain"],
    ["Software Engineer", "engineering"],
    ["IT Manager", "it"],
    ["Product Manager", "product"],
    ["Data Analyst", "data"],
    ["Legal Counsel", "legal"],
    ["Customer Success Manager", "customer_success"],
    ["Operations Manager", "operations"],
  ])("%s → %s", (raw, dept) => {
    expect(t(raw).department).toBe(dept);
  });

  it("puts top-level roles in executive", () => {
    expect(t("Chief Executive Officer").department).toBe("executive");
    expect(t("Managing Director").department).toBe("executive");
  });
});

describe("noise that should not change the role", () => {
  it("strips regions", () => {
    expect(t("VP of Sales, EMEA").seniority).toBe("vp");
    expect(t("VP of Sales, EMEA").department).toBe("sales");
    expect(t("Regional Director - GCC").seniority).toBe("director");
  });

  it("strips tenure and status markers", () => {
    expect(t("Interim CFO").seniority).toBe("c_suite");
    expect(t("Acting Head of HR").seniority).toBe("head");
  });

  it("handles separators interchangeably", () => {
    const forms = ["VP, Sales", "VP - Sales", "VP / Sales", "VP | Sales", "VP of Sales"];
    const results = forms.map((f) => t(f));
    expect(new Set(results.map((r) => `${r.seniority}:${r.department}`)).size).toBe(1);
  });

  it("strips diacritics", () => {
    expect(t("Diréctor of Finánce").seniority).toBe("director");
  });
});

describe("seniority rank supports range queries", () => {
  it("is ordered so 'VP and above' is a single comparison", () => {
    const vpAndAbove = ["Chairman", "Founder", "CEO", "VP"].map((x) => t(x).seniorityRank);
    const below = ["Director", "Head of Sales", "Manager", "Analyst"].map((x) => t(x).seniorityRank);
    expect(Math.min(...vpAndAbove)).toBeGreaterThan(Math.max(...below));
  });

  it("gives unknown the lowest rank so it never satisfies a floor", () => {
    expect(t("").seniorityRank).toBe(0);
    expect(SENIORITY_RANK.unknown).toBe(0);
  });
});

describe("graceful handling of junk", () => {
  it("marks an unrecognisable title unmatched and keeps the original", () => {
    const r = t("Zzyx Qqwertian Blimforth");
    expect(r.unmatched).toBe(true);
    expect(r.canonicalTitle).toBe("Zzyx Qqwertian Blimforth");
    expect(r.seniority).toBe("unknown");
  });

  it("never throws on empty, null or undefined", () => {
    for (const raw of ["", "   ", null, undefined]) {
      const r = normalizeTitle(raw as string);
      expect(r.unmatched).toBe(true);
      expect(r.rawTitle).toBe("");
    }
  });

  it("always preserves the raw title", () => {
    expect(t("  Chief Executive Officer  ").rawTitle).toBe("Chief Executive Officer");
  });

  it("defaults a recognised function with no seniority signal to mid-level", () => {
    const r = t("Accountant");
    expect(r.department).toBe("finance");
    expect(r.seniority).toBe("mid");
    expect(r.unmatched).toBe(false);
  });
});

describe("prepareTitle", () => {
  it("expands abbreviations before matching", () => {
    expect(prepareTitle("CFO")).toContain("chief financial officer");
    expect(prepareTitle("Sr. BD Manager")).toContain("senior business development manager");
  });
});

describe("expandTitleQuery", () => {
  it("returns a department filter for a functional search", () => {
    const q = expandTitleQuery("Head of Procurement");
    expect(q.seniority).toBe("head");
    expect(q.department).toBe("procurement");
  });

  it("falls back to text for an unrecognised term", () => {
    const q = expandTitleQuery("Zzyx Blimforth");
    expect(q.seniority).toBeNull();
    expect(q.department).toBeNull();
    expect(q.text).toBe("zzyx blimforth");
  });
});
