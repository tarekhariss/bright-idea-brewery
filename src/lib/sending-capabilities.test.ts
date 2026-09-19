import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACTIVE_SENDING_CAPABILITIES,
  SMTP_ADAPTER_CAPABILITIES,
  UNSUPPORTED_FIELD_NOTICE,
  shouldShowUnsupportedValue,
} from "./sending-capabilities";

/**
 * The bug these guard against: the UI offered CC and BCC, saved them, and the
 * sender discarded them. Recipients received nothing, with no error shown.
 *
 * `deno.land/x/smtp@v0.7.0`'s SendConfig is { to, from, subject, content, html? }
 * and send() issues RCPT TO: for `to` alone. Until the adapter changes, the UI
 * must not imply that CC, BCC or multiple recipients are delivered.
 */

describe("the current SMTP adapter's declared capabilities", () => {
  it("does not claim CC support", () => {
    expect(SMTP_ADAPTER_CAPABILITIES.supportsCc).toBe(false);
  });

  it("does not claim BCC support", () => {
    expect(SMTP_ADAPTER_CAPABILITIES.supportsBcc).toBe(false);
  });

  it("does not claim multiple primary recipients", () => {
    // parseAddress() wraps the whole string in angle brackets, so
    // "a@x.com, b@y.com" becomes a malformed RCPT TO and the send fails.
    expect(SMTP_ADAPTER_CAPABILITIES.supportsMultipleTo).toBe(false);
  });

  it("is the active adapter", () => {
    expect(ACTIVE_SENDING_CAPABILITIES).toBe(SMTP_ADAPTER_CAPABILITIES);
  });
});

describe("showing values that will not be delivered", () => {
  it("surfaces a configured value rather than hiding it", () => {
    // Someone set this. They are entitled to know it is inert.
    expect(shouldShowUnsupportedValue(false, "manager@acme.com")).toBe(true);
  });

  it("says nothing when the field is unsupported and empty", () => {
    expect(shouldShowUnsupportedValue(false, "")).toBe(false);
    expect(shouldShowUnsupportedValue(false, "   ")).toBe(false);
    expect(shouldShowUnsupportedValue(false, null)).toBe(false);
    expect(shouldShowUnsupportedValue(false, undefined)).toBe(false);
  });

  it("says nothing when the capability is supported", () => {
    expect(shouldShowUnsupportedValue(true, "manager@acme.com")).toBe(false);
  });

  it("states plainly that the value will not be delivered", () => {
    expect(UNSUPPORTED_FIELD_NOTICE).toMatch(/not be delivered/i);
    expect(UNSUPPORTED_FIELD_NOTICE).toMatch(/not supported/i);
  });
});

/**
 * Source-level guard. A future edit could reintroduce an editable CC field
 * without touching this module, so assert the UI itself stays honest.
 */
describe("the campaign options UI cannot imply CC/BCC delivery", () => {
  const source = readFileSync(
    "src/components/engage/campaign/CampaignOptionsTab.tsx",
    "utf8",
  );

  it("does not accept edits to CC or BCC", () => {
    expect(source).not.toMatch(/onChange=\{\(e\)\s*=>\s*setCc\(/);
    expect(source).not.toMatch(/onChange=\{\(e\)\s*=>\s*setBcc\(/);
  });

  it("reads the capability flags rather than hardcoding the limitation", () => {
    expect(source).toContain("ACTIVE_SENDING_CAPABILITIES.supportsCc");
    expect(source).toContain("ACTIVE_SENDING_CAPABILITIES.supportsBcc");
  });

  it("shows the unsupported notice next to both fields", () => {
    expect(source).toContain("UNSUPPORTED_FIELD_NOTICE");
    expect(source).toContain('id="cc-unsupported"');
    expect(source).toContain('id="bcc-unsupported"');
  });

  it("still loads saved values so they are preserved, not erased", () => {
    expect(source).toContain("setCc(c.cc ?? \"\")");
    expect(source).toContain("setBcc(c.bcc ?? \"\")");
  });
});
