import { describe, expect, it } from "vitest";
import {
  isUsableProfile,
  mapProfile,
  normalizeLinkedInUrl,
  toCountryCode,
  toDomain,
  toEmployeeCount,
} from "./profile-mapper";

const opts = { source: "coresignal", datasetVersion: "2026-09" };
const map = (r: Record<string, unknown>) => mapProfile(r, opts);

describe("country normalisation — the filter that matters most here", () => {
  it.each([
    ["Saudi Arabia", "SA"], ["saudi arabia", "SA"], ["KSA", "SA"],
    ["Kingdom of Saudi Arabia", "SA"], ["SA", "SA"], ["SAU", "SA"],
    ["United Arab Emirates", "AE"], ["UAE", "AE"], ["Emirates", "AE"],
    ["Qatar", "QA"], ["Kuwait", "KW"], ["Bahrain", "BH"], ["Oman", "OM"],
    ["Egypt", "EG"], ["Jordan", "JO"],
  ])("%s → %s", (input, code) => {
    expect(toCountryCode(input)).toBe(code);
  });

  it("handles KSA, which most country libraries omit", () => {
    // Very common in regional datasets and absent from ISO name lists.
    expect(toCountryCode("KSA")).toBe("SA");
  });

  it("returns a canonical display name alongside the code", () => {
    expect(map({ name: "A B", title: "CEO", country: "KSA", company: "X" }).country)
      .toBe("Saudi Arabia");
  });

  it("passes through an unknown bare ISO-2 rather than dropping it", () => {
    expect(toCountryCode("ZW")).toBe("ZW");
  });

  it("returns null for junk", () => {
    expect(toCountryCode("Zzyxland")).toBeNull();
    expect(toCountryCode(null)).toBeNull();
  });
});

describe("company size becomes range-filterable", () => {
  it("uses an explicit count when present", () => {
    expect(toEmployeeCount("250", null)).toBe(250);
    expect(toEmployeeCount("1,500", null)).toBe(1500);
  });

  it("reduces a band to its midpoint so BETWEEN works", () => {
    expect(toEmployeeCount(null, "51-200")).toBe(126);
    expect(toEmployeeCount(null, "11 - 50")).toBe(31);
  });

  it("uses the floor of an open band", () => {
    expect(toEmployeeCount(null, "10001+")).toBe(10001);
    expect(toEmployeeCount(null, "5000 employees")).toBe(5000);
  });

  it("prefers the explicit count over the band", () => {
    expect(toEmployeeCount("87", "51-200")).toBe(87);
  });

  it("keeps the original band string for display", () => {
    // "51-200" is more honest to show a user than "126".
    const row = map({ name: "A B", title: "CEO", country: "SA", company: "X", employee_range: "51-200" });
    expect(row.employee_range).toBe("51-200");
    expect(row.employee_count).toBe(126);
  });

  it("returns null rather than zero when size is unknown", () => {
    // Zero would match a "fewer than 10 employees" filter and be wrong.
    expect(toEmployeeCount(null, null)).toBeNull();
    expect(toEmployeeCount("unknown", null)).toBeNull();
  });
});

describe("vendor field-name variance", () => {
  it("reads a Coresignal-style record", () => {
    const row = map({
      member_url: "https://www.linkedin.com/in/asmith",
      member_name: "Ahmed Smith",
      active_experience_title: "Chief Financial Officer",
      active_experience_company_name: "Acme Arabia",
      company_employees_count: 400,
      location_country: "Saudi Arabia",
      location_city: "Riyadh",
    });
    expect(row.full_name).toBe("Ahmed Smith");
    expect(row.raw_title).toBe("Chief Financial Officer");
    expect(row.seniority).toBe("c_suite");
    expect(row.department).toBe("finance");
    expect(row.country_code).toBe("SA");
    expect(row.employee_count).toBe(400);
  });

  it("reads a PDL-style record", () => {
    const row = map({
      linkedin_url: "linkedin.com/in/bkhan",
      first_name: "Bilal",
      last_name: "Khan",
      job_title: "VP of Procurement",
      organization_name: "Gulf Logistics",
      organization_industry: "Logistics",
      country: "UAE",
    });
    expect(row.first_name).toBe("Bilal");
    expect(row.seniority).toBe("vp");
    expect(row.department).toBe("procurement");
    expect(row.company_industry).toBe("Logistics");
    expect(row.country_code).toBe("AE");
  });

  it("reads a plain CSV export", () => {
    const row = map({
      "Full Name": "Fatima Al-Rashid",
      "Job Title": "General Manager",
      Company: "Doha Retail Group",
      Country: "Qatar",
      "Company Size": "201-500",
    });
    expect(row.full_name).toBe("Fatima Al-Rashid");
    expect(row.seniority).toBe("c_suite"); // GM is country-level in Gulf
    expect(row.country_code).toBe("QA");
    expect(row.employee_count).toBe(351);
  });

  it("treats vendor null markers as empty", () => {
    const row = map({ name: "A B", title: "CEO", country: "SA", company: "X", industry: "N/A", city: "-" });
    expect(row.company_industry).toBeNull();
    expect(row.city).toBeNull();
  });
});

describe("names", () => {
  it("derives first and last from a full name", () => {
    const row = map({ name: "Ahmed Al Saud", title: "CEO", country: "SA", company: "X" });
    expect(row.first_name).toBe("Ahmed");
    expect(row.last_name).toBe("Saud");
  });

  it("prefers explicit parts over derived ones", () => {
    const row = map({ name: "Wrong Name", first_name: "Ahmed", last_name: "Al-Saud", title: "CEO", country: "SA", company: "X" });
    expect(row.first_name).toBe("Ahmed");
    expect(row.last_name).toBe("Al-Saud");
  });

  it("builds a full name from parts when absent", () => {
    const row = map({ first_name: "Ahmed", last_name: "Khan", title: "CEO", country: "SA", company: "X" });
    expect(row.full_name).toBe("Ahmed Khan");
  });
});

describe("linkedin url and domain", () => {
  it("canonicalises profile urls", () => {
    for (const raw of [
      "linkedin.com/in/asmith",
      "https://linkedin.com/in/asmith/",
      "https://www.linkedin.com/in/asmith?trk=x",
      "HTTP://WWW.LinkedIn.com/in/asmith",
    ]) {
      expect(normalizeLinkedInUrl(raw)).toBe("https://www.linkedin.com/in/asmith");
    }
  });

  it("rejects a non-LinkedIn url", () => {
    expect(normalizeLinkedInUrl("https://twitter.com/asmith")).toBeNull();
  });

  it("extracts a bare domain from a website", () => {
    expect(toDomain("https://www.acme.com/about")).toBe("acme.com");
    expect(toDomain("acme.com")).toBe("acme.com");
    expect(toDomain("not a domain")).toBeNull();
  });
});

describe("titles are normalised at load time, not query time", () => {
  it("stores the band and rank so filters do not parse strings", () => {
    const row = map({ name: "A B", title: "Founder & CEO", country: "SA", company: "X" });
    expect(row.seniority).toBe("founder");
    expect(row.seniority_rank).toBeGreaterThan(90);
    expect(row.raw_title).toBe("Founder & CEO"); // original preserved
  });

  it("leaves title fields null when the vendor gave no title", () => {
    const row = map({ name: "A B", country: "SA", company: "X" });
    expect(row.raw_title).toBeNull();
    expect(row.seniority).toBeNull();
    expect(row.seniority_rank).toBe(0);
  });
});

describe("usability filter keeps the count honest", () => {
  const base = { name: "Ahmed Khan", title: "CEO", country: "Saudi Arabia", company: "Acme" };

  it("accepts a resolvable profile", () => {
    expect(isUsableProfile(map(base)).usable).toBe(true);
  });

  it("rejects a profile with no name", () => {
    expect(isUsableProfile(map({ ...base, name: null })).reason).toBe("no_name");
  });

  it("rejects a profile with no way to resolve contact details later", () => {
    // No LinkedIn URL, no company, no domain — the waterfall has nothing to
    // resolve from, so storing it only inflates the headline number.
    const r = isUsableProfile(map({ name: "Ahmed Khan", title: "CEO", country: "SA" }));
    expect(r.usable).toBe(false);
    expect(r.reason).toBe("no_resolvable_identity");
  });

  it("rejects a profile with no country, since country is the primary filter", () => {
    expect(isUsableProfile(map({ ...base, country: "Zzyxland" })).reason).toBe("no_country");
  });

  it("accepts a profile with a LinkedIn URL but no company", () => {
    const r = isUsableProfile(map({
      name: "Ahmed Khan", title: "CEO", country: "SA",
      linkedin_url: "linkedin.com/in/akhan",
    }));
    expect(r.usable).toBe(true);
  });
});

describe("provenance is always recorded", () => {
  it("stamps source and dataset version on every row", () => {
    const row = map({ name: "A B", title: "CEO", country: "SA", company: "X" });
    expect(row.source).toBe("coresignal");
    expect(row.source_dataset_version).toBe("2026-09");
  });
});
