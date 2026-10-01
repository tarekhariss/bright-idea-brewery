/**
 * Validating a single primary recipient.
 *
 * The current SMTP adapter (`deno.land/x/smtp@v0.7.0`) sends to exactly one
 * address. Its `parseAddress` does:
 *
 *     const m = email.match(/(.*)\s<(.*)>/);
 *     return m?.length === 3 ? [`<${m[2]}>`, email] : [`<${email}>`, `<${email}>`];
 *
 * So `"a@x.com, b@y.com"` produces `RCPT TO:<a@x.com, b@y.com>` — a malformed
 * SMTP command. The server rejects it and the send fails with an opaque protocol
 * error, after the message has already been queued.
 *
 * A display name IS supported: `"John Smith <john@acme.com>"` parses correctly,
 * with the bare address used for RCPT and the full string for the To: header.
 *
 * This module refuses multiple recipients **before** anything is queued or
 * dispatched, and refuses them the same way on both sides of the wire. It never
 * silently truncates to the first address: quietly emailing one of two intended
 * recipients is worse than refusing, because nobody finds out.
 */

export type RecipientRejection =
  | "empty"
  | "multiple"
  | "malformed";

export interface RecipientValidation {
  valid: boolean;
  /** The single address to hand to the sender, normalised. Null when invalid. */
  address: string | null;
  /** Display name when supplied as `Name <addr>`, else null. */
  displayName: string | null;
  /** Machine-readable reason, for structured API errors. */
  reason: RecipientRejection | null;
  /** Message intended for a person to read. */
  message: string | null;
}

/** Shown wherever a multi-recipient attempt is refused. */
export const SINGLE_RECIPIENT_NOTICE =
  "This sending adapter currently supports one recipient per message.";

/** Separators that indicate a recipient list rather than one mailbox. */
const LIST_SEPARATORS = /[,;]/;

/** Conservative address shape. Deliberately not RFC 5322 — that is unbounded. */
const ADDRESS = /^[^\s@<>,;]+@[^\s@<>,;]+\.[A-Za-z]{2,}$/;

/** `Display Name <addr@example.com>` */
const DISPLAY_FORM = /^\s*(.*?)\s*<([^<>]+)>\s*$/;

const ok = (address: string, displayName: string | null): RecipientValidation => ({
  valid: true,
  address,
  displayName,
  reason: null,
  message: null,
});

const fail = (reason: RecipientRejection, message: string): RecipientValidation => ({
  valid: false,
  address: null,
  displayName: null,
  reason,
  message,
});

/**
 * Validate that `input` names exactly one deliverable mailbox.
 *
 * Accepts `addr@example.com` and `Display Name <addr@example.com>`.
 * Rejects empty input, anything containing a list separator, anything with more
 * than one angle-bracketed mailbox, whitespace-separated addresses, and
 * malformed addresses.
 */
export function validateSingleRecipient(input: string | null | undefined): RecipientValidation {
  const raw = (input ?? "").trim();

  if (raw.length === 0) {
    return fail("empty", "Enter a recipient email address.");
  }

  // A comma or semicolon anywhere means a list was intended, even if the rest
  // would parse. Refusing is the point; truncating is what we are avoiding.
  if (LIST_SEPARATORS.test(raw)) {
    return fail("multiple", SINGLE_RECIPIENT_NOTICE);
  }

  // More than one angle-bracketed mailbox, e.g. "A <a@x.com> B <b@y.com>".
  const bracketed = raw.match(/<[^<>]*>/g) ?? [];
  if (bracketed.length > 1) {
    return fail("multiple", SINGLE_RECIPIENT_NOTICE);
  }

  const display = raw.match(DISPLAY_FORM);
  if (display) {
    const name = display[1].replace(/^["']|["']$/g, "").trim();
    const address = display[2].trim();
    if (!ADDRESS.test(address)) {
      return fail("malformed", "That does not look like a valid email address.");
    }
    return ok(address, name.length > 0 ? name : null);
  }

  // No display form. Whitespace now means two bare addresses side by side.
  if (/\s/.test(raw)) {
    // Distinguish "two addresses" from "one address with a stray space", so the
    // message tells the person which mistake they made.
    const parts = raw.split(/\s+/).filter(Boolean);
    const addressLike = parts.filter((p) => p.includes("@"));
    if (addressLike.length > 1) {
      return fail("multiple", SINGLE_RECIPIENT_NOTICE);
    }
    return fail("malformed", "That does not look like a valid email address.");
  }

  if (!ADDRESS.test(raw)) {
    return fail("malformed", "That does not look like a valid email address.");
  }

  return ok(raw, null);
}

/**
 * The string to hand the SMTP library: the display form when a name was given,
 * otherwise the bare address. Only call this for a validated recipient.
 */
export function formatRecipient(validation: RecipientValidation): string {
  if (!validation.valid || !validation.address) {
    throw new Error("formatRecipient called with an invalid recipient");
  }
  return validation.displayName
    ? `${validation.displayName} <${validation.address}>`
    : validation.address;
}
