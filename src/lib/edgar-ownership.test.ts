import { describe, expect, it } from "vitest";
import {
  effectiveTitle,
  filingXmlUrl,
  isUsableOwner,
  looksLikeEntity,
  normalizeCik,
  parseOwnershipForm,
  resolveEdgarLocation,
  splitEdgarName,
} from "./edgar-ownership";

/** A Form 4 shaped the way EDGAR publishes them. */
const form4 = (owners: string, issuer = `
    <issuerCik>0000320193</issuerCik>
    <issuerName>Apple Inc.</issuerName>
    <issuerTradingSymbol>AAPL</issuerTradingSymbol>`) => `<?xml version="1.0"?>
<ownershipDocument>
  <schemaVersion>X0508</schemaVersion>
  <documentType>4</documentType>
  <periodOfReport>2026-01-15</periodOfReport>
  <issuer>${issuer}</issuer>
  ${owners}
</ownershipDocument>`;

const owner = (opts: {
  name: string;
  cik?: string;
  director?: string;
  officer?: string;
  tenPercent?: string;
  other?: string;
  title?: string;
  city?: string;
  state?: string;
}) => `
  <reportingOwner>
    <reportingOwnerId>
      <rptOwnerCik>${opts.cik ?? "0001214128"}</rptOwnerCik>
      <rptOwnerName>${opts.name}</rptOwnerName>
    </reportingOwnerId>
    <reportingOwnerAddress>
      <rptOwnerCity>${opts.city ?? "CUPERTINO"}</rptOwnerCity>
      <rptOwnerState>${opts.state ?? "CA"}</rptOwnerState>
    </reportingOwnerAddress>
    <reportingOwnerRelationship>
      <isDirector>${opts.director ?? "0"}</isDirector>
      <isOfficer>${opts.officer ?? "0"}</isOfficer>
      <isTenPercentOwner>${opts.tenPercent ?? "0"}</isTenPercentOwner>
      <isOther>${opts.other ?? "0"}</isOther>
      ${opts.title === undefined ? "" : `<officerTitle>${opts.title}</officerTitle>`}
    </reportingOwnerRelationship>
  </reportingOwner>`;

describe("EDGAR names are surname-first, which is the whole parsing problem", () => {
  it("reads a conformed name in EDGAR order", () => {
    // "COOK TIMOTHY D" is Timothy Cook. Left-to-right reading swaps every
    // person in the database and breaks email inference downstream.
    expect(splitEdgarName("COOK TIMOTHY D")).toEqual({
      firstName: "Timothy",
      lastName: "Cook",
      middleName: "D",
      suffix: null,
    });
  });

  it("reads a two-token name", () => {
    expect(splitEdgarName("MUSK ELON")).toMatchObject({ firstName: "Elon", lastName: "Musk" });
  });

  it("treats a comma as authoritative", () => {
    expect(splitEdgarName("Cook, Timothy D")).toMatchObject({
      firstName: "Timothy",
      lastName: "Cook",
      middleName: "D",
    });
  });

  it("keeps a multi-token surname behind its comma", () => {
    expect(splitEdgarName("Van Der Hoeven, Jan Pieter")).toMatchObject({
      firstName: "Jan",
      lastName: "Van Der Hoeven",
      middleName: "Pieter",
    });
  });

  it("keeps surname particles with the surname without a comma", () => {
    // Without particle handling this yields lastName "Van", firstName "Der".
    expect(splitEdgarName("VAN DER HOEVEN JAN PIETER")).toMatchObject({
      firstName: "Jan",
      lastName: "Van Der Hoeven",
    });
    expect(splitEdgarName("DE LA CRUZ MARIA")).toMatchObject({
      firstName: "Maria",
      lastName: "De La Cruz",
    });
    expect(splitEdgarName("AL RASHID AHMED")).toMatchObject({
      firstName: "Ahmed",
      lastName: "Al Rashid",
    });
  });

  it("strips generational and professional suffixes", () => {
    expect(splitEdgarName("SMITH JOHN JR")).toMatchObject({
      firstName: "John", lastName: "Smith", suffix: "Jr",
    });
    expect(splitEdgarName("GATES WILLIAM H III")).toMatchObject({
      firstName: "William", lastName: "Gates", middleName: "H", suffix: "Iii",
    });
    expect(splitEdgarName("CHEN WEI MD")).toMatchObject({
      firstName: "Wei", lastName: "Chen", suffix: "Md",
    });
  });

  it("title-cases apostrophes, hyphens and Mc/Mac", () => {
    expect(splitEdgarName("O'BRIEN MARY K").lastName).toBe("O'Brien");
    expect(splitEdgarName("SMITH-JONES ANNA").lastName).toBe("Smith-Jones");
    expect(splitEdgarName("MCDONALD JAMES").lastName).toBe("McDonald");
    expect(splitEdgarName("MACARTHUR DOUGLAS").lastName).toBe("MacArthur");
  });

  it("does not mangle short names that merely start with mac", () => {
    expect(splitEdgarName("MACY ROWAN").lastName).toBe("Macy");
  });

  it("returns a surname only when there is one token", () => {
    expect(splitEdgarName("CHER")).toMatchObject({ firstName: null, lastName: "Cher" });
  });

  it("returns nothing for an empty name", () => {
    expect(splitEdgarName("   ")).toEqual({
      firstName: null, lastName: null, middleName: null, suffix: null,
    });
  });
});

describe("institutional holders file the same forms as executives", () => {
  it.each([
    "BLACKROCK INC.",
    "State Street Corporation",
    "Vanguard Group Inc",
    "Sequoia Capital Partners LP",
    "Acme Holdings LLC",
    "SMITH FAMILY TRUST",
    "Tiger Global Management, L.L.C.",
    "Bessemer Venture Partners",
    "FMR LLC",
  ])("excludes %s", (name) => {
    expect(looksLikeEntity(name)).toBe(true);
  });

  it.each([
    "COOK TIMOTHY D",
    "MUSK ELON",
    "O'BRIEN MARY K",
    "VAN DER HOEVEN JAN",
  ])("keeps %s", (name) => {
    expect(looksLikeEntity(name)).toBe(false);
  });

  it("excludes a plain-named holder with no board seat and no office", () => {
    // A founder's personal holding vehicle reads like a person but is an
    // investor, not someone to contact.
    expect(looksLikeEntity("ANDERSON HOLDINGS", { isTenPercentOwner: true })).toBe(true);
    expect(looksLikeEntity("ANDERSON ROBERT", {
      isTenPercentOwner: true, isDirector: false, isOfficer: false,
    })).toBe(true);
  });

  it("keeps a 10% owner who is also a director", () => {
    expect(looksLikeEntity("ANDERSON ROBERT", {
      isTenPercentOwner: true, isDirector: true,
    })).toBe(false);
  });

  it("excludes a single-token name", () => {
    expect(looksLikeEntity("BLACKROCK")).toBe(true);
  });
});

describe("a board seat is not a mid-level Director", () => {
  it("calls a director with no officer title a Board Member", () => {
    // The title ontology ranks a bare "Director" in the manager/director band,
    // which is right for "Director of Marketing" and wrong for a board seat —
    // it would bury the highest-value contacts below VPs.
    expect(effectiveTitle({ isDirector: true })).toBe("Board Member");
  });

  it("prefers the officer title when someone holds both roles", () => {
    expect(effectiveTitle({
      officerTitle: "Chief Executive Officer", isOfficer: true, isDirector: true,
    })).toBe("Chief Executive Officer");
  });

  it("falls back for an officer with no stated title", () => {
    expect(effectiveTitle({ isOfficer: true })).toBe("Officer");
  });

  it("has no title for a bare shareholder", () => {
    expect(effectiveTitle({ isTenPercentOwner: true })).toBe("Shareholder");
    expect(effectiveTitle({})).toBeNull();
  });

  it("ranks a Board Member above a VP once normalised", () => {
    const board = parseOwnershipForm(form4(owner({ name: "LEVINSON ARTHUR D", director: "1" })))!;
    expect(board.owners[0].normalizedTitle?.seniority).toBe("board");
  });
});

describe("parsing a filing", () => {
  it("extracts the issuer and a named officer", () => {
    const filing = parseOwnershipForm(form4(owner({
      name: "COOK TIMOTHY D", director: "1", officer: "1", title: "Chief Executive Officer",
    })))!;

    expect(filing.formType).toBe("4");
    expect(filing.periodOfReport).toBe("2026-01-15");
    expect(filing.issuer).toEqual({
      cik: "0000320193", name: "Apple Inc.", tradingSymbol: "AAPL",
    });

    const [o] = filing.owners;
    expect(o.firstName).toBe("Timothy");
    expect(o.lastName).toBe("Cook");
    expect(o.isDirector).toBe(true);
    expect(o.isOfficer).toBe(true);
    expect(o.officerTitle).toBe("Chief Executive Officer");
    expect(o.normalizedTitle?.seniority).toBe("c_suite");
    expect(o.city).toBe("CUPERTINO");
    expect(o.state).toBe("CA");
    expect(o.isEntity).toBe(false);
  });

  it("always preserves the name exactly as EDGAR published it", () => {
    const filing = parseOwnershipForm(form4(owner({ name: "COOK TIMOTHY D", officer: "1", title: "CEO" })))!;
    expect(filing.owners[0].rawName).toBe("COOK TIMOTHY D");
  });

  it("reads several reporting owners from one filing", () => {
    const filing = parseOwnershipForm(form4(
      owner({ name: "COOK TIMOTHY D", officer: "1", title: "CEO", cik: "0001214128" }) +
      owner({ name: "LEVINSON ARTHUR D", director: "1", cik: "0001214129" }) +
      owner({ name: "BLACKROCK INC.", tenPercent: "1", cik: "0001086364" }),
    ))!;

    expect(filing.owners).toHaveLength(3);
    expect(filing.owners.map((o) => o.isEntity)).toEqual([false, false, true]);
  });

  it("accepts a title wrapped in a value element", () => {
    // EDGAR writes both shapes depending on the filer agent.
    const xml = form4(`
      <reportingOwner>
        <reportingOwnerId>
          <rptOwnerCik>0001214128</rptOwnerCik>
          <rptOwnerName>COOK TIMOTHY D</rptOwnerName>
        </reportingOwnerId>
        <reportingOwnerRelationship>
          <isOfficer><value>1</value></isOfficer>
          <officerTitle><value>Chief Financial Officer</value></officerTitle>
        </reportingOwnerRelationship>
      </reportingOwner>`);
    const [o] = parseOwnershipForm(xml)!.owners;
    expect(o.isOfficer).toBe(true);
    expect(o.officerTitle).toBe("Chief Financial Officer");
    expect(o.normalizedTitle?.department).toBe("finance");
  });

  it("decodes XML entities in names", () => {
    const filing = parseOwnershipForm(form4(owner({
      name: "O&apos;BRIEN MARY K", director: "1",
    })))!;
    expect(filing.owners[0].lastName).toBe("O'Brien");
  });

  it("does not leave an entity with parsed name parts", () => {
    // A fund has no first and last name; inventing them would put "Blackrock"
    // through email generation as if it were a person.
    const [o] = parseOwnershipForm(form4(owner({ name: "BLACKROCK INC.", tenPercent: "1" })))!.owners;
    expect(o.firstName).toBeNull();
    expect(o.lastName).toBeNull();
    expect(o.rawName).toBe("BLACKROCK INC.");
  });

  it("returns null for a document that is not an ownership form", () => {
    expect(parseOwnershipForm("<html><body>Not a filing</body></html>")).toBeNull();
    expect(parseOwnershipForm("")).toBeNull();
  });

  it("skips a reporting owner with no name rather than failing the filing", () => {
    const xml = form4(`
      <reportingOwner>
        <reportingOwnerId><rptOwnerCik>0001</rptOwnerCik></reportingOwnerId>
      </reportingOwner>` + owner({ name: "COOK TIMOTHY D", officer: "1", title: "CEO" }));
    const filing = parseOwnershipForm(xml)!;
    expect(filing.owners).toHaveLength(1);
    expect(filing.owners[0].lastName).toBe("Cook");
  });

  it("tolerates a missing address block", () => {
    const xml = form4(`
      <reportingOwner>
        <reportingOwnerId>
          <rptOwnerCik>0001214128</rptOwnerCik>
          <rptOwnerName>COOK TIMOTHY D</rptOwnerName>
        </reportingOwnerId>
        <reportingOwnerRelationship><isOfficer>1</isOfficer><officerTitle>CEO</officerTitle></reportingOwnerRelationship>
      </reportingOwner>`);
    const [o] = parseOwnershipForm(xml)!.owners;
    expect(o.city).toBeNull();
    expect(o.lastName).toBe("Cook");
  });
});

describe("CIK normalisation", () => {
  it("zero-pads to ten digits so both EDGAR spellings match", () => {
    expect(normalizeCik("320193")).toBe("0000320193");
    expect(normalizeCik("0000320193")).toBe("0000320193");
    expect(normalizeCik("CIK0000320193")).toBe("0000320193");
  });

  it("returns null for junk", () => {
    expect(normalizeCik("")).toBeNull();
    expect(normalizeCik(null)).toBeNull();
    expect(normalizeCik("abc")).toBeNull();
  });
});

describe("usability keeps the pool contactable", () => {
  const parse = (o: string) => parseOwnershipForm(form4(o))!.owners[0];

  it("accepts a named officer", () => {
    expect(isUsableOwner(parse(owner({
      name: "COOK TIMOTHY D", officer: "1", title: "CEO",
    }))).usable).toBe(true);
  });

  it("rejects an institution", () => {
    expect(isUsableOwner(parse(owner({ name: "BLACKROCK INC.", tenPercent: "1" }))).reason)
      .toBe("not_a_person");
  });

  it("rejects a person with no given name", () => {
    expect(isUsableOwner(parse(owner({ name: "CHER", director: "1" }))).reason)
      .toBe("not_a_person"); // single token is treated as an entity first
  });

  it("rejects an owner with no role at the company", () => {
    const o = parse(owner({ name: "SMITH JOHN A", other: "1" }));
    expect(isUsableOwner(o).reason).toBe("no_role");
  });
});

describe("archive URL construction", () => {
  it("builds the raw XML url from a bare primary document", () => {
    expect(filingXmlUrl("0000320193", "0000320193-26-000008", "wf-form4_173.xml"))
      .toBe("https://www.sec.gov/Archives/edgar/data/320193/000032019326000008/wf-form4_173.xml");
  });

  it("strips the XSL-rendered subdirectory to reach the machine-readable XML", () => {
    // The submissions API often points at the rendered view; the parseable XML
    // sits beside it under the same filename.
    expect(filingXmlUrl("320193", "0000320193-26-000008", "xslF345X03/wf-form4_173.xml"))
      .toBe("https://www.sec.gov/Archives/edgar/data/320193/000032019326000008/wf-form4_173.xml");
  });

  it("returns null for an HTML-only filing rather than a url that 404s", () => {
    expect(filingXmlUrl("320193", "0000320193-26-000008", "form4.htm")).toBeNull();
  });

  it("returns null on missing inputs", () => {
    expect(filingXmlUrl("", "0000320193-26-000008", "a.xml")).toBeNull();
    expect(filingXmlUrl("320193", "", "a.xml")).toBeNull();
    expect(filingXmlUrl("320193", "0000320193-26-000008", "")).toBeNull();
  });
});

describe("EDGAR mixes US states and countries in one field", () => {
  const toCountry = (v: string | null) =>
    v === null ? null : ({ "CANADA": "CA", "UNITED KINGDOM": "GB", GB: "GB" }[v.toUpperCase()] ?? null);

  it("reads CA as California, not Canada", () => {
    // EDGAR is a US filing system and its state codes win. Resolving this as a
    // country would relocate a large share of US companies abroad, and country
    // is the primary search filter.
    expect(resolveEdgarLocation({ stateOrCountry: "CA" }, toCountry))
      .toEqual({ countryCode: "US", region: "CA" });
  });

  it("prefers an explicit country field", () => {
    expect(resolveEdgarLocation({ stateOrCountry: "X0", country: "Canada" }, toCountry))
      .toEqual({ countryCode: "CA", region: null });
  });

  it("resolves a non-state code as a country", () => {
    expect(resolveEdgarLocation({ stateOrCountry: "GB" }, toCountry))
      .toEqual({ countryCode: "GB", region: null });
  });

  it("keeps an unrecognised code as the region rather than discarding it", () => {
    expect(resolveEdgarLocation({ stateOrCountry: "A1" }, toCountry))
      .toEqual({ countryCode: null, region: "A1" });
  });

  it("handles a missing address", () => {
    expect(resolveEdgarLocation(null, toCountry)).toEqual({ countryCode: null, region: null });
  });
});
