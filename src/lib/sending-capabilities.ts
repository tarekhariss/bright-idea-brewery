/**
 * What the current outbound sending adapter can actually do.
 *
 * The UI previously offered CC and BCC fields, saved them, and then the sender
 * discarded them — recipients received nothing, with no error and no indication
 * anything had been dropped. This module exists so the UI asks the adapter what
 * it supports instead of assuming.
 *
 * Present adapter: `deno.land/x/smtp@v0.7.0`, used by the `send-email` edge
 * function. Its `SendConfig` is:
 *
 *     interface SendConfig { to: string; from: string; subject: string;
 *                           content: string; html?: string; }
 *
 * There is no `cc` and no `bcc`, and `send()` issues `RCPT TO:` for `config.to`
 * alone. Anything else passed in is silently ignored by the library.
 *
 * This is deliberately a plain descriptor, not a provider abstraction. When
 * outbound moves to a real adapter interface, this becomes one implementation of
 * it and the UI keeps reading the same flags.
 */

export interface SendingCapabilities {
  /** Carbon-copy recipients are delivered. */
  supportsCc: boolean;
  /** Blind-carbon-copy recipients are delivered. */
  supportsBcc: boolean;
  /** More than one primary recipient per message. */
  supportsMultipleTo: boolean;
  /** A Reply-To header distinct from the From address. */
  supportsReplyTo: boolean;
  /** In-Reply-To / References threading headers. */
  supportsThreading: boolean;
  /** Open and click tracking injected by the sender. */
  supportsTracking: boolean;
}

/**
 * Capabilities of the SMTP adapter in `send-email`.
 *
 * `supportsReplyTo` is true because Reply-To is carried as campaign
 * configuration and applied outside this library's SendConfig.
 */
export const SMTP_ADAPTER_CAPABILITIES: SendingCapabilities = {
  supportsCc: false,
  supportsBcc: false,
  supportsMultipleTo: false,
  supportsReplyTo: true,
  supportsThreading: false,
  supportsTracking: false,
};

/** The adapter currently in use for outbound email. */
export const ACTIVE_SENDING_CAPABILITIES = SMTP_ADAPTER_CAPABILITIES;

/**
 * Explanation shown wherever an unsupported field is surfaced. Phrased for the
 * person reading it, not for a changelog: it must be obvious that a value saved
 * here will not reach anyone.
 */
export const UNSUPPORTED_FIELD_NOTICE =
  "Not supported by the current email sender. Existing values are kept but will not be delivered.";

/**
 * Whether a saved value should still be displayed even though the capability is
 * missing. Hiding a configured value would be worse than showing it read-only —
 * someone set it and is entitled to know it is inert.
 */
export function shouldShowUnsupportedValue(
  supported: boolean,
  savedValue: string | null | undefined,
): boolean {
  return !supported && !!savedValue && savedValue.trim().length > 0;
}
