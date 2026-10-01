/**
 * Streaming, quote-aware CSV record reader.
 *
 * A CSV record is not a line. Vendor exports routinely carry free-text columns —
 * company descriptions, headlines, notes — whose quoted values contain newlines,
 * and a real export of 50,000 contacts can span 216,000 physical lines.
 *
 * Splitting that input on newlines shreds every multi-line record into
 * fragments. The damage is quiet rather than loud: the fragments parse, they
 * just hold the wrong values in the wrong columns. In the run that prompted this
 * module, 99,170 of 145,039 apparent rows were fragments. The totals it reported
 * were nonsense even though the extracted emails happened to be right, because
 * fragments rarely contain an `@`. A fragment that does would have produced a
 * silently bogus observation.
 *
 * So records are assembled from the byte stream with the quote state carried
 * across both newlines and chunk boundaries, which is the only way to know where
 * a record actually ends.
 *
 * Memory stays flat: one record is held at a time, never the file.
 */

export interface CsvReadOptions {
  /** Field delimiter. Comma unless a vendor insists otherwise. */
  delimiter?: string;
}

/**
 * Yield each record as an array of fields.
 *
 * `source` is any async iterable of strings — a read stream in Node, or an array
 * of chunks in a test. Keeping it generic is what lets this be tested without
 * touching the filesystem.
 */
export async function* csvRecords(
  source: AsyncIterable<string> | Iterable<string>,
  options: CsvReadOptions = {},
): AsyncGenerator<string[]> {
  const delimiter = options.delimiter ?? ",";

  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  // A quote seen while inside a quoted field is ambiguous until the next
  // character: `""` is an escaped quote, anything else closes the field. That
  // next character may arrive in the following chunk, so the ambiguity is
  // carried as state rather than resolved by lookahead.
  let pendingQuote = false;
  let sawAnyChar = false;

  for await (const chunk of source as AsyncIterable<string>) {
    for (const c of chunk) {
      sawAnyChar = true;

      if (pendingQuote) {
        pendingQuote = false;
        if (c === '"') {
          field += '"';
          continue;
        }
        inQuotes = false;
        // Fall through: this character is structural.
      }

      if (inQuotes) {
        if (c === '"') pendingQuote = true;
        else field += c; // newlines and carriage returns belong to the value
        continue;
      }

      if (c === '"') {
        inQuotes = true;
        continue;
      }
      if (c === delimiter) {
        record.push(field);
        field = "";
        continue;
      }
      if (c === "\r") continue; // CRLF: the LF ends the record
      if (c === "\n") {
        record.push(field);
        yield record;
        record = [];
        field = "";
        continue;
      }
      field += c;
    }
  }

  // A final record with no trailing newline is still a record.
  if (field !== "" || record.length > 0) {
    record.push(field);
    yield record;
  } else if (!sawAnyChar) {
    // Empty input yields nothing, rather than one empty record.
  }
}

/** Normalise a header cell to the snake_case key the mappers expect. */
export function headerKey(value: string): string {
  return value
    .replace(/^﻿/, "") // BOM, which Excel exports put on the first header
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * Records as objects keyed by header.
 *
 * Short rows are padded rather than dropped: a truncated trailing column is
 * common in hand-edited exports and is not a reason to discard a contact.
 */
export async function* csvObjects(
  source: AsyncIterable<string> | Iterable<string>,
  options: CsvReadOptions = {},
): AsyncGenerator<Record<string, string>> {
  let header: string[] | null = null;

  for await (const record of csvRecords(source, options)) {
    if (header === null) {
      header = record.map(headerKey);
      continue;
    }
    // A blank line between records is not a record.
    if (record.length === 1 && record[0].trim() === "") continue;

    const row: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = record[i] ?? "";
    yield row;
  }
}
