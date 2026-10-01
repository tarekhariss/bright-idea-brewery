import { describe, expect, it } from "vitest";
import { csvObjects, csvRecords, headerKey } from "./csv-records";

const collect = async <T>(gen: AsyncGenerator<T>): Promise<T[]> => {
  const out: T[] = [];
  for await (const item of gen) out.push(item);
  return out;
};

/** Feed the parser in fixed-size pieces, to exercise chunk boundaries. */
function* inChunks(text: string, size: number): Iterable<string> {
  for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size);
}

describe("a record is not a line", () => {
  it("keeps a quoted newline inside its field", () => {
    // The bug this module exists for: vendor exports carry descriptions with
    // newlines, and splitting on \n shreds the record into fragments that parse
    // but hold the wrong values in the wrong columns.
    const csv = 'name,bio\nAhmed,"line one\nline two"\nSara,short\n';
    return expect(collect(csvRecords([csv]))).resolves.toEqual([
      ["name", "bio"],
      ["Ahmed", "line one\nline two"],
      ["Sara", "short"],
    ]);
  });

  it("handles several newlines in one field", async () => {
    const csv = 'a,b\n1,"x\ny\nz"\n';
    expect(await collect(csvRecords([csv]))).toEqual([["a", "b"], ["1", "x\ny\nz"]]);
  });

  it("keeps carriage returns inside a quoted field but not outside", async () => {
    const csv = 'a,b\r\n1,"x\r\ny"\r\n';
    expect(await collect(csvRecords([csv]))).toEqual([["a", "b"], ["1", "x\r\ny"]]);
  });
});

describe("quoting", () => {
  it("unescapes doubled quotes", async () => {
    const csv = 'a\n"He said ""hello"""\n';
    expect(await collect(csvRecords([csv]))).toEqual([["a"], ['He said "hello"']]);
  });

  it("keeps delimiters inside quotes", async () => {
    const csv = 'name,title\n"Smith, John","VP, Sales"\n';
    expect(await collect(csvRecords([csv]))).toEqual([
      ["name", "title"],
      ["Smith, John", "VP, Sales"],
    ]);
  });

  it("handles an empty quoted field", async () => {
    expect(await collect(csvRecords(['a,b\n"",x\n']))).toEqual([["a", "b"], ["", "x"]]);
  });

  it("handles a field that is only quotes", async () => {
    expect(await collect(csvRecords(['a\n""""\n']))).toEqual([["a"], ['"']]);
  });
});

describe("chunk boundaries cannot change the result", () => {
  const csv =
    'first,last,bio\n' +
    'Ahmed,"Al-Rashid","multi\nline ""quoted"" bio, with commas"\n' +
    'Mary,"O\'Brien",plain\n';

  const expected = [
    ["first", "last", "bio"],
    ["Ahmed", "Al-Rashid", 'multi\nline "quoted" bio, with commas'],
    ["Mary", "O'Brien", "plain"],
  ];

  it.each([1, 2, 3, 5, 7, 13, 64, 4096])("parses identically at chunk size %i", async (size) => {
    // Quote state and the escaped-quote ambiguity both have to survive a chunk
    // split. A size of 1 puts every boundary in the worst possible place.
    expect(await collect(csvRecords(inChunks(csv, size)))).toEqual(expected);
  });
});

describe("edges", () => {
  it("yields nothing for empty input", async () => {
    expect(await collect(csvRecords([]))).toEqual([]);
    expect(await collect(csvRecords([""]))).toEqual([]);
  });

  it("yields the final record when there is no trailing newline", async () => {
    expect(await collect(csvRecords(["a,b\n1,2"]))).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("treats an unterminated quote as running to end of input", async () => {
    // Malformed, but discarding the record loses a contact; keeping what is
    // there loses nothing.
    expect(await collect(csvRecords(['a\n"unterminated']))).toEqual([["a"], ["unterminated"]]);
  });

  it("supports an alternative delimiter", async () => {
    expect(await collect(csvRecords(["a;b\n1;2\n"], { delimiter: ";" })))
      .toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("header keys", () => {
  it.each([
    ["First Name", "first_name"],
    ["Email Domain Catchall", "email_domain_catchall"],
    ["  Company Website  ", "company_website"],
    ["Employees-Count", "employees_count"],
  ])("%s -> %s", (input, expected) => {
    expect(headerKey(input)).toBe(expected);
  });

  it("strips the BOM Excel puts on the first header", () => {
    // Without this the first column is named "﻿first_name" and every
    // lookup of it silently misses.
    expect(headerKey("﻿First Name")).toBe("first_name");
  });
});

describe("records as objects", () => {
  it("keys fields by normalised header", async () => {
    const csv = 'First Name,Last Name,Email\nAhmed,Khan,a@x.com\n';
    expect(await collect(csvObjects([csv]))).toEqual([
      { first_name: "Ahmed", last_name: "Khan", email: "a@x.com" },
    ]);
  });

  it("pads a short row rather than dropping the contact", async () => {
    const csv = "a,b,c\n1,2\n";
    expect(await collect(csvObjects([csv]))).toEqual([{ a: "1", b: "2", c: "" }]);
  });

  it("skips blank lines between records", async () => {
    const csv = "a\n1\n\n2\n";
    expect(await collect(csvObjects([csv]))).toEqual([{ a: "1" }, { a: "2" }]);
  });

  it("reads a record whose field spans lines", async () => {
    const csv = 'name,bio\nAhmed,"two\nlines"\n';
    expect(await collect(csvObjects([csv]))).toEqual([{ name: "Ahmed", bio: "two\nlines" }]);
  });
});
