// UPI link parsing and rewriting.
//
// A signed link is kept byte-for-byte whenever it already carries an amount:
// UPI signatures cover every byte before `&sign=`. When a link has to be
// changed (an amount is added, or an unsigned link is normalised), it is
// rebuilt as a small, correctly encoded intent. Merchant-only tags are dropped
// because an unsigned merchant intent makes some UPI apps ignore the amount.

import { decodeBase64, encodeBase64, utf8Bytes, utf8Text } from "./base64";

const UPI_PREFIX = /^upi:\/\/pay\?/i;
const STOP_CHARS = /[\s"'`<>]/;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}>»…]+$/;
const REQUEST_TRIGGER = /(?:^|\s):txt\b/i;
/** NPCI caps a single UPI payment at one lakh rupees. */
export const MAX_UPI_AMOUNT = 100000;

/**
 * True when a message carries the request prefix. Virtual keyboards often
 * capitalise the first letter, so this must never be case sensitive.
 * @param {string} text
 */
export function hasRequestTrigger(text) {
  return typeof text === "string" && REQUEST_TRIGGER.test(text);
}

function splitPairs(query) {
  if (!query) return [];
  return query.split("&").map((raw) => {
    const eq = raw.indexOf("=");
    return eq === -1
      ? { key: raw, value: null, raw }
      : { key: raw.slice(0, eq), value: raw.slice(eq + 1), raw };
  });
}

function decode(value) {
  if (value == null) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function firstValue(pairs, key, { decodeValue = false } = {}) {
  for (const pair of pairs) {
    if (pair.key !== key) continue;
    if (pair.value == null || pair.value === "") continue;
    return decodeValue ? decode(pair.value) : pair.value;
  }
  return null;
}

function withoutNull(value) {
  return value != null && value.toLowerCase() !== "null" ? value : null;
}

/**
 * Normalise a UPI amount to a plain decimal string. Returns null for anything
 * a UPI app would not accept (commas, currency symbols, zero, negative values).
 * @param {string | number | null | undefined} value
 * @returns {string | null}
 */
export function normalizeAmount(value) {
  const text = String(value ?? "")
    .trim()
    .replace(/,/g, "");

  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? String(number) : null;
}

function minAmount(mam) {
  if (mam == null) return null;
  const value = Number(String(mam).trim());
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Parse a UPI intent link without modifying it.
 * @param {string} raw
 */
export function parseUpiLink(raw) {
  const source = typeof raw === "string" ? raw : "";
  const result = {
    raw: source,
    pa: null,
    pn: null,
    am: null,
    mam: null,
    cu: null,
    tn: null,
    tr: null,
    signed: false,
    valid: false,
    reason: null,
  };

  const text = source.trim();
  if (!text) {
    result.reason = "Scan a UPI QR code to start a request.";
    return result;
  }

  const prefix = text.match(UPI_PREFIX);
  if (!prefix) {
    result.reason = "This is not a UPI payment link.";
    return result;
  }

  const pairs = splitPairs(text.slice(prefix[0].length));
  result.pa = firstValue(pairs, "pa", { decodeValue: true });
  result.pn = firstValue(pairs, "pn", { decodeValue: true });
  result.am = withoutNull(firstValue(pairs, "am"));
  result.mam = withoutNull(firstValue(pairs, "mam"));
  result.cu = firstValue(pairs, "cu");
  result.tn = firstValue(pairs, "tn", { decodeValue: true });
  result.tr = firstValue(pairs, "tr", { decodeValue: true });
  result.signed = pairs.some((pair) => pair.key === "sign");

  if (!result.pa) {
    result.reason = "This UPI link has no payee address.";
    return result;
  }
  if (result.cu != null && result.cu.toUpperCase() !== "INR") {
    result.reason = "Only INR payments are supported.";
    return result;
  }

  result.valid = true;
  return result;
}

function generateTr() {
  return `TXT${Date.now()}`;
}

/**
 * Build the smallest valid intent for a request.
 *
 * `mc`, `mid`, `mode`, `url` and `sign` are deliberately left out. Once an
 * amount is added to a signed merchant QR the signature cannot be kept, and a
 * half-merchant intent is what makes some PSP apps open the pay screen with an
 * empty amount. A plain intent still pays the same VPA, and `tr`/`tn` keep the
 * order reference and note.
 * @param {ReturnType<typeof parseUpiLink>} parsed
 * @param {string} amount
 * @param {{ tr?: string | null }} [options]
 */
function cleanLink(parsed, amount, options = {}) {
  const params = [];
  const add = (key, value, raw = false) => {
    if (value == null || value === "") return;
    params.push(`${key}=${raw ? value : encodeURIComponent(value)}`);
  };

  const tr = parsed.tr || (options.tr !== undefined ? options.tr : generateTr());

  add("pa", encodeURIComponent(parsed.pa).replace(/%40/g, "@"), true);
  add("pn", parsed.pn);
  add("am", amount);
  add("cu", "INR");
  add("tr", tr);
  add("tn", parsed.tn);

  return "upi://pay?" + params.join("&");
}

/**
 * Add or normalise the amount on a UPI link.
 *
 * - A signed link that already has a usable amount is returned untouched so
 *   the signature stays valid.
 * - Every other link with a usable amount is rebuilt as a clean intent. This
 *   also fixes links whose values contain raw spaces from route params.
 * - When no amount can be found the original link is returned unchanged.
 * @param {string} raw
 * @param {string} amount
 * @param {{ tr?: string | null }} [options]
 * @returns {{ link: string, strippedSignature: boolean, amount: string | null }}
 */
export function buildRequestLink(raw, amount, options = {}) {
  const parsed = parseUpiLink(raw);
  if (!parsed.valid) {
    return { link: parsed.raw, strippedSignature: false, amount: null };
  }

  const linkAmount = normalizeAmount(parsed.am);
  const finalAmount = linkAmount ?? normalizeAmount(amount);

  if (parsed.signed) {
    return {
      link: parsed.raw,
      strippedSignature: false,
      amount: finalAmount,
    };
  }

  if (!finalAmount) {
    return { link: parsed.raw, strippedSignature: false, amount: null };
  }

  return {
    link: cleanLink(parsed, finalAmount, options),
    strippedSignature: parsed.signed,
    amount: finalAmount,
  };
}

/**
 * Find every UPI link in a message.
 * @param {string} text
 * @returns {string[]}
 */
export function extractUpiLinks(text) {
  if (typeof text !== "string") return [];

  const lower = text.toLowerCase();
  const links = [];
  const seen = new Set();
  let from = 0;

  while (from < text.length) {
    const start = lower.indexOf("upi://pay?", from);
    if (start === -1) break;

    let end = start + "upi://pay?".length;
    while (end < text.length) {
      const char = text[end];
      if (/[\r\n"'`=<>]/.test(char) && char !== "=") break;
      if (/\s/.test(char)) {
        const remainder = text.slice(end);
        // Allow unencoded spaces if followed by more query parameters (e.g. pn=John Doe&am=100)
        if (!/^\s+[^&\s=]*&/.test(remainder) && !/^\s*&/.test(remainder)) {
          break;
        }
      }
      end++;
    }

    let link = text.slice(start, end).replace(TRAILING_PUNCTUATION, "");
    link = link.replace(/ /g, "%20");
    if (link && !seen.has(link)) {
      seen.add(link);
      links.push(link);
    }

    from = Math.max(end, start + 1);
  }

  return links;
}

/**
 * Find the first UPI link anywhere in a message.
 * @param {string} text
 * @returns {string | null}
 */
export function extractUpiLink(text) {
  return extractUpiLinks(text)[0] ?? null;
}

/**
 * Validate a typed amount, honouring `mam` when the link carries one.
 * @param {string} value
 * @param {string | null} mam
 * @returns {{ valid: boolean, reason: string | null, amount: string | null }}
 */
export function validateAmount(value, mam) {
  const typed = String(value ?? "")
    .trim()
    .replace(/,/g, "");

  if (!typed) return { valid: false, reason: "Enter an amount.", amount: null };
  if (!/^\d+(\.\d{1,2})?$/.test(typed)) {
    return { valid: false, reason: "Use numbers with up to 2 decimals.", amount: null };
  }

  const number = Number(typed);
  if (!Number.isFinite(number) || number <= 0) {
    return { valid: false, reason: "Amount must be more than zero.", amount: null };
  }

  const min = minAmount(mam);
  if (min != null && number < min) {
    return {
      valid: false,
      reason: `Minimum amount is ₹${min}.`,
      amount: null,
    };
  }

  if (number > MAX_UPI_AMOUNT) {
    return {
      valid: false,
      reason: "Amount cannot be more than ₹1,00,000.",
      amount: null,
    };
  }

  return { valid: true, reason: null, amount: String(number) };
}

/**
 * Extract the requested payment amount from an SMS body (e.g. ":txt Pay Rs 250 ...").
 * @param {string} text
 * @returns {string | null}
 */
export function extractRequestAmount(text) {
  if (typeof text !== "string") return null;
  const match = text.match(/(?:^|\s):txt\s+Pay(?:\s+Rs\.?|\s+INR)?\s+([0-9]+(?:\.[0-9]{1,2})?)/i);
  return match ? normalizeAmount(match[1]) : null;
}

/**
 * Format a 10-digit mobile number or standard UPI ID into an NPCI UPI payment URI.
 * @param {{ mobileOrVpa: string, amount?: string | number | null, name?: string | null, note?: string | null }} input
 * @returns {{ valid: boolean, link: string | null, reason: string | null, vpa: string | null, amount: string | null }}
 */
export function buildMobilePaymentLink({ mobileOrVpa, amount, name = null, note = null }) {
  const raw = String(mobileOrVpa ?? "").trim();
  if (!raw) {
    return { valid: false, link: null, reason: "Enter a mobile number or UPI ID.", vpa: null, amount: null };
  }

  let vpa;
  if (raw.includes("@")) {
    vpa = raw.replace(/\s+/g, "");
    if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(vpa)) {
      return { valid: false, link: null, reason: "Enter a valid UPI ID (e.g. name@bank).", vpa: null, amount: null };
    }
  } else {
    const digits = raw.replace(/\D/g, "");
    const cleanDigits = digits.length >= 10 ? digits.slice(-10) : digits;
    if (cleanDigits.length !== 10) {
      return { valid: false, link: null, reason: "Enter a valid 10-digit mobile number.", vpa: null, amount: null };
    }
    vpa = `${cleanDigits}@upi`;
  }

  const normalizedAmount = amount != null && String(amount).trim() !== "" ? normalizeAmount(amount) : null;
  const params = [];
  params.push(`pa=${encodeURIComponent(vpa).replace(/%40/g, "@")}`);
  if (name && name.trim()) {
    params.push(`pn=${encodeURIComponent(name.trim())}`);
  }
  if (normalizedAmount) {
    params.push(`am=${normalizedAmount}`);
  }
  params.push("cu=INR");
  if (note && note.trim()) {
    params.push(`tn=${encodeURIComponent(note.trim())}`);
  }

  return {
    valid: true,
    link: `upi://pay?${params.join("&")}`,
    reason: null,
    vpa,
    amount: normalizedAmount,
  };
}

/**
 * Build the SMS body. The prefix lets the receiver app recognise the request.
 * @param {string} link
 * @param {string} amount
 */
export function buildRequestText(link, amount) {
  const value = String(amount ?? "").trim();
  return `:txt ${value ? `Pay Rs ${value}` : "Pay"} ${link}`.trim();
}

/**
 * Encode a UPI link for an Expo Router param.
 *
 * Expo Router decodes route params twice. A normal percent-encoded query
 * therefore turns `%20` into a raw space, and the receiver's link scanner then
 * stops at that space. Base64url has no `%`, `&` or spaces, so the link
 * survives the trip intact.
 * @param {string} link
 */
export function encodeLinkParam(link) {
  const text = String(link ?? "");
  return encodeBase64(utf8Bytes(text))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * Decode a value produced by {@link encodeLinkParam}. Raw legacy links and
 * single-encoded links are accepted too.
 * @param {unknown} value
 */
export function decodeLinkParam(value) {
  const text = String(value ?? "");
  if (!text) return "";
  if (UPI_PREFIX.test(text)) return text;

  if (/^upi%3a/i.test(text)) {
    try {
      return decodeURIComponent(text);
    } catch {
      return text;
    }
  }

  const decoded = utf8Text(
    decodeBase64(text.replace(/-/g, "+").replace(/_/g, "/")),
  );
  return UPI_PREFIX.test(decoded) ? decoded : text;
}
