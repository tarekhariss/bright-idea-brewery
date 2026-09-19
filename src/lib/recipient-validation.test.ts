import { describe, expect, it } from "vitest";
import {
  SINGLE_RECIPIENT_NOTICE,
  formatRecipient,
  validateSingleRecipient,
} from "./recipient-validation";

const v = validateSingleRecipient;

describe("accepts exactly one mailbox", () => {
  it("a bare address", () => {
    const r = v("john@acme.com");
    expect(r.valid).toBe(true);
    expect(r.address).toBe("john@acme.com");
    expect(r.displayName).toBeNull();
  });

  it("an address with a display name — the adapter does support this", () => {
    const r = v("John Smith <john@acme.com>");
    expect(r.valid).toBe(true);
    expect(r.address).toBe("john@acme.com");
    expect(r.displayName).toBe("John Smith");
  });

  it("a quoted display name", () => {
    const r = v('"Smith, John" <john@acme.com>');
    // Contains a comma inside quotes — still refused, because the SMTP layer
    // cannot be trusted to re-quote it and a comma is how lists are written.
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("multiple");
  });

  it("trims surrounding whitespace", () => {
    expect(v("  john@acme.com  ").address).toBe("john@acme.com");
  });

  it("accepts subdomains and plus-addressing", () => {
    expect(v("john+crm@mail.acme.co.uk").valid).toBe(true);
  });
});

describe("refuses recipient lists", () => {
  it("comma-separated", () => {
    const r = v("a@x.com, b@y.com");
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("multiple");
    expect(r.message).toBe(SINGLE_RECIPIENT_NOTICE);
  });

  it("comma-separated without a space", () => {
    expect(v("a@x.com,b@y.com").reason).toBe("multiple");
  });

  it("semicolon-separated", () => {
    expect(v("a@x.com; b@y.com").reason).toBe("multiple");
  });

  it("whitespace-separated", () => {
    expect(v("a@x.com b@y.com").reason).toBe("multiple");
  });

  it("multiple display-name mailboxes", () => {
    expect(v("A One <a@x.com> B Two <b@y.com>").reason).toBe("multiple");
  });

  it("a trailing comma, which signals a list was being typed", () => {
    expect(v("a@x.com,").reason).toBe("multiple");
  });

  it("NEVER silently truncates to the first address", () => {
    const r = v("a@x.com, b@y.com");
    expect(r.address).toBeNull();
    expect(r.valid).toBe(false);
  });
});

describe("refuses malformed and empty input", () => {
  it("empty", () => {
    const r = v("");
    expect(r.reason).toBe("empty");
    expect(r.message).toMatch(/enter a recipient/i);
  });

  it("whitespace only", () => {
    expect(v("   ").reason).toBe("empty");
  });

  it("null and undefined", () => {
    expect(v(null).reason).toBe("empty");
    expect(v(undefined).reason).toBe("empty");
  });

  it("no @", () => {
    expect(v("notanemail").reason).toBe("malformed");
  });

  it("no domain dot", () => {
    expect(v("john@localhost").reason).toBe("malformed");
  });

  it("an unclosed display form", () => {
    expect(v("John <john@acme.com").reason).toBe("malformed");
  });

  it("a malformed address inside a display form", () => {
    expect(v("John Smith <not-an-email>").reason).toBe("malformed");
  });

  it("one address with a stray space reads as malformed, not as a list", () => {
    const r = v("john @acme.com");
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("malformed");
  });
});

describe("formatRecipient", () => {
  it("returns the bare address when there is no display name", () => {
    expect(formatRecipient(v("john@acme.com"))).toBe("john@acme.com");
  });

  it("reassembles the display form", () => {
    expect(formatRecipient(v("John Smith <john@acme.com>"))).toBe("John Smith <john@acme.com>");
  });

  it("refuses to format an invalid recipient", () => {
    expect(() => formatRecipient(v("a@x.com, b@y.com"))).toThrow();
  });
});

describe("nothing invalid can reach the SMTP layer", () => {
  const MUST_REJECT = [
    "a@x.com, b@y.com",
    "a@x.com;b@y.com",
    "a@x.com b@y.com",
    "A <a@x.com> B <b@y.com>",
    "",
    "   ",
    "notanemail",
    "john@localhost",
  ];

  it.each(MUST_REJECT)("refuses %j and yields no address", (input) => {
    const r = v(input);
    expect(r.valid).toBe(false);
    expect(r.address).toBeNull();
    // A caller that only checks `address` still cannot send anything.
    expect(() => formatRecipient(r)).toThrow();
  });
});
