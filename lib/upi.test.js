import { describe, expect, test } from "bun:test";
import {
  buildMobilePaymentLink,
  buildRequestLink,
  buildRequestText,
  decodeLinkParam,
  encodeLinkParam,
  extractRequestAmount,
  extractUpiLink,
  extractUpiLinks,
  isMerchantUpi,
  isPersonalUpi,
  normalizeAmount,
  parseUpiLink,
  validateAmount,
} from "./upi";

const SIGNED_WITH_AM = "upi://pay?pa=a@b&pn=A&am=10&sign=xxx";
const SIGNED_NO_AM = "upi://pay?pa=a@b&pn=A&mode=00&sign=xxx";
const UNSIGNED_NO_AM = "upi://pay?pa=a@b&pn=A";

describe("parseUpiLink", () => {
  test("reads payee, amount, minimum, note, reference and signature flag", () => {
    const parsed = parseUpiLink(
      "upi://pay?pa=bivek@npci&pn=bivek%20rath&am=10&mam=5&cu=INR&tr=ORDER%201&tn=Pay%20to%20mystar&sign=abc=",
    );
    expect(parsed.valid).toBe(true);
    expect(parsed.pa).toBe("bivek@npci");
    expect(parsed.pn).toBe("bivek rath");
    expect(parsed.am).toBe("10");
    expect(parsed.mam).toBe("5");
    expect(parsed.cu).toBe("INR");
    expect(parsed.tr).toBe("ORDER 1");
    expect(parsed.tn).toBe("Pay to mystar");
    expect(parsed.signed).toBe(true);
  });

  test("accepts an uppercase scheme", () => {
    const parsed = parseUpiLink("UPI://PAY?pa=a@b&pn=A");
    expect(parsed.valid).toBe(true);
    expect(parsed.pa).toBe("a@b");
  });

  test("rejects a non-UPI url", () => {
    const parsed = parseUpiLink("https://example.com/pay?pa=a@b");
    expect(parsed.valid).toBe(false);
    expect(parsed.reason).toBeTruthy();
  });

  test("rejects a link without pa", () => {
    expect(parseUpiLink("upi://pay?pn=A").valid).toBe(false);
    expect(parseUpiLink("upi://pay?pa=").valid).toBe(false);
    expect(parseUpiLink("upi://pay").valid).toBe(false);
  });

  test("rejects a currency other than INR", () => {
    expect(parseUpiLink("upi://pay?pa=a@b&cu=USD").valid).toBe(false);
    expect(parseUpiLink("upi://pay?pa=a@b&cu=INR").valid).toBe(true);
  });

  test("treats null/empty am and mam as absent", () => {
    expect(parseUpiLink("upi://pay?pa=a@b&am=").am).toBe(null);
    expect(parseUpiLink("upi://pay?pa=a@b&am=null").am).toBe(null);
    expect(parseUpiLink("upi://pay?pa=a@b&mam=null").mam).toBe(null);
  });

  test("reads mc parameter when present", () => {
    expect(parseUpiLink("upi://pay?pa=shop@bank&mc=5411").mc).toBe("5411");
    expect(parseUpiLink("upi://pay?pa=user@bank").mc).toBe(null);
  });

  test("classifies merchant vs personal upi links", () => {
    expect(isMerchantUpi("upi://pay?pa=shop@bank&mc=5411")).toBe(true);
    expect(isPersonalUpi("upi://pay?pa=shop@bank&mc=5411")).toBe(false);

    expect(isMerchantUpi("upi://pay?pa=ashwinjba19@oksbi&pn=Ashwin%20JB")).toBe(false);
    expect(isPersonalUpi("upi://pay?pa=ashwinjba19@oksbi&pn=Ashwin%20JB")).toBe(true);

    expect(isMerchantUpi("upi://pay?pa=user@bank&mc=0000")).toBe(false);
    expect(isPersonalUpi("upi://pay?pa=user@bank&mc=0000")).toBe(true);
  });
});

describe("buildRequestLink", () => {
  test("returns the link byte-for-byte and reads the amount back", () => {
    expect(buildRequestLink(SIGNED_WITH_AM)).toEqual({
      link: SIGNED_WITH_AM,
      amount: "10",
    });
  });

  test("never injects an amount and never rewrites parameters", () => {
    expect(buildRequestLink(UNSIGNED_NO_AM)).toEqual({
      link: UNSIGNED_NO_AM,
      amount: null,
    });
  });

  test("keeps a base64 signature untouched", () => {
    const raw =
      "upi://pay?pa=bivekrath@npci&pn=bivek%20rath&am=10&sign=sQpPJ0YkdEHIV4b1Hme566aEp1XXXqfe9wqaXgUDfhCfSV1MWdgXnfIQcQYBHaZjDbcuIVrhcq11vhmmURYKsDb1ZbbXRlGXxDhIul5etM/EckmiIbpD90njclCyrLmOe6dp5F0rxzXsiTbjvCN8tUFc4fLFZktMnNF3+L8jqHc=";
    expect(buildRequestLink(raw).link).toBe(raw);
  });

  test("keeps a signed merchant QR completely intact with all parameters", () => {
    const raw =
      "upi://pay?pa=bivek%40npci&pn=bivek%20rath&mc=9999&tid=cxnk&tr=4894&tn=Pay%20to%20mystar%20store&mam=null&cu=INR&url=https://mystar.com/orderid=9298yw89&mode=02&orgid=123456&mid=1234&msid=3432&mtid=1212&sign=sQpPJ0YkdEHIV4b1Hme566aEp1XXXqfe9wqaXgUDfhCfSV1MWdgXnfIQcQYBHaZjDbcuIVrhcq11vhmmURYKsDb1ZbbXRlGXxDhIul5etM/EckmiIbpD90njclCyrLmOe6dp5F0rxzXsiTbjvCN8tUFc4fLFZktMnNF3+L8jqHc=";
    const { link, amount } = buildRequestLink(raw);
    expect(link).toBe(raw);
    expect(amount).toBe(null);
    expect(link).toContain("sign=");
    expect(link).toContain("mc=9999");
  });

  test("keeps signatures and unusual parameter order exactly as received", () => {
    expect(buildRequestLink("upi://pay?pa=a@b&am=&sign=xxx")).toEqual({
      link: "upi://pay?pa=a@b&am=&sign=xxx",
      amount: null,
    });
    expect(buildRequestLink("upi://pay?pa=a@b&sign=xxx&pn=A")).toEqual({
      link: "upi://pay?pa=a@b&sign=xxx&pn=A",
      amount: null,
    });
  });

  test("reads the first duplicate am without touching the link", () => {
    const raw = "upi://pay?pa=a@b&am=10&am=20";
    const { link, amount } = buildRequestLink(raw);
    expect(link).toBe(raw);
    expect(amount).toBe("10");
  });

  test("passes an invalid link through untouched with no amount", () => {
    expect(buildRequestLink("https://example.com")).toEqual({
      link: "https://example.com",
      amount: null,
    });
  });

  test("trims only outer whitespace, never the link body", () => {
    expect(buildRequestLink(SIGNED_NO_AM)).toEqual({
      link: SIGNED_NO_AM,
      amount: null,
    });
  });

  test("reads an amount the link already carries, even a comma amount", () => {
    expect(buildRequestLink("upi://pay?pa=a@b&am=1,000")).toEqual({
      link: "upi://pay?pa=a@b&am=1,000",
      amount: "1000",
    });
  });
});

describe("normalizeAmount", () => {
  test("accepts plain decimal values", () => {
    expect(normalizeAmount("250")).toBe("250");
    expect(normalizeAmount("250.50")).toBe("250.5");
    expect(normalizeAmount("1,000")).toBe("1000");
    expect(normalizeAmount(10)).toBe("10");
  });

  test("rejects empty, zero, negative and malformed values", () => {
    expect(normalizeAmount("")).toBe(null);
    expect(normalizeAmount("0")).toBe(null);
    expect(normalizeAmount("-5")).toBe(null);
    expect(normalizeAmount("12.345")).toBe(null);
    expect(normalizeAmount("₹250")).toBe(null);
    expect(normalizeAmount(null)).toBe(null);
  });
});

describe("extractUpiLink", () => {
  test("finds a link after a sender prefix", () => {
    expect(
      extractUpiLink("From HDFC: :txt Pay Rs 250 upi://pay?pa=a@b&am=250"),
    ).toBe("upi://pay?pa=a@b&am=250");
  });

  test("trims trailing punctuation and quotes", () => {
    expect(extractUpiLink("pay now: upi://pay?pa=a@b&am=10.")).toBe(
      "upi://pay?pa=a@b&am=10",
    );
    expect(extractUpiLink('send "upi://pay?pa=a@b&am=10" today')).toBe(
      "upi://pay?pa=a@b&am=10",
    );
  });

  test("keeps base64 signature characters", () => {
    const link = "upi://pay?pa=a@b&sign=ab+cd/ef==";
    expect(extractUpiLink(`:txt ${link}`)).toBe(link);
  });

  test("returns the first link and handles uppercase", () => {
    expect(
      extractUpiLink(
        ":txt UPI://PAY?pa=a@b upi://pay?pa=c@d",
      ),
    ).toBe("UPI://PAY?pa=a@b");
  });

  test("returns null when there is no link", () => {
    expect(extractUpiLink(":txt hello")).toBe(null);
    expect(extractUpiLink(null)).toBe(null);
    expect(extractUpiLinks(":txt hello")).toEqual([]);
  });

  test("finds every link in a grouped notification", () => {
    expect(
      extractUpiLinks(
        ":txt Pay Rs 10 upi://pay?pa=a@b&am=10\n:txt Pay Rs 20 upi://pay?pa=c@d&am=20",
      ),
    ).toEqual(["upi://pay?pa=a@b&am=10", "upi://pay?pa=c@d&am=20"]);
  });

  test("preserves query parameters even with unencoded spaces in values", () => {
    expect(
      extractUpiLink(
        ":txt Pay Rs 100 upi://pay?pa=test@bank&pn=John Doe&am=100&cu=INR",
      ),
    ).toBe("upi://pay?pa=test@bank&pn=John%20Doe&am=100&cu=INR");
  });
});

describe("validateAmount", () => {
  test("accepts whole and two-decimal amounts", () => {
    expect(validateAmount("250", null)).toEqual({
      valid: true,
      reason: null,
      amount: "250",
    });
    expect(validateAmount("250.50", null).amount).toBe("250.5");
    expect(validateAmount("1,000", null).amount).toBe("1000");
  });

  test("rejects empty, zero, negative and long decimals", () => {
    expect(validateAmount("", null).valid).toBe(false);
    expect(validateAmount("0", null).valid).toBe(false);
    expect(validateAmount("-5", null).valid).toBe(false);
    expect(validateAmount("12.345", null).valid).toBe(false);
    expect(validateAmount("abc", null).valid).toBe(false);
  });

  test("enforces mam when present", () => {
    expect(validateAmount("100", "250").valid).toBe(false);
    expect(validateAmount("250", "250").valid).toBe(true);
    expect(validateAmount("300", "250").valid).toBe(true);
    expect(validateAmount("100", null).valid).toBe(true);
    expect(validateAmount("100", "null").valid).toBe(true);
    expect(validateAmount("100", "").valid).toBe(true);
  });
});

describe("buildRequestText", () => {
  test("prefixes the message with :txt and states the amount", () => {
    expect(buildRequestText("upi://pay?pa=a@b&am=250", "250")).toBe(
      ":txt Pay Rs 250 upi://pay?pa=a@b&am=250",
    );
  });

  test("omits the amount when there is none", () => {
    expect(buildRequestText("upi://pay?pa=a@b", "")).toBe(
      ":txt Pay upi://pay?pa=a@b",
    );
  });
});

describe("link route params", () => {
  const link =
    "upi://pay?pa=a%40b&pn=My%20Shop&am=250&cu=INR&tr=A%26B&tn=Hi%20there";

  test("survives the router's double decode", () => {
    const token = encodeLinkParam(link);
    expect(token).not.toMatch(/[%&=+/]/);
    expect(decodeLinkParam(token)).toBe(link);
    expect(decodeLinkParam(decodeURIComponent(decodeURIComponent(token)))).toBe(
      link,
    );
  });

  test("accepts a raw or single-encoded legacy link", () => {
    expect(decodeLinkParam(link)).toBe(link);
    expect(decodeLinkParam(encodeURIComponent(link))).toBe(link);
    expect(decodeLinkParam("")).toBe("");
    expect(decodeLinkParam("not a link")).toBe("not a link");
  });
});

describe("extractRequestAmount", () => {
  test("extracts amount from standard :txt trigger", () => {
    expect(extractRequestAmount(":txt Pay Rs 250 upi://pay?pa=a@b")).toBe("250");
    expect(extractRequestAmount(":txt Pay Rs. 250.50 upi://pay?pa=a@b")).toBe("250.5");
    expect(extractRequestAmount(":txt Pay INR 100 upi://pay?pa=a@b")).toBe("100");
    expect(extractRequestAmount(":txt Pay 2 upi://pay?pa=a@b")).toBe("2");
  });

  test("ignores keyboard capitalisation and extra text", () => {
    expect(extractRequestAmount("Hey :Txt Pay Rs 500 upi://pay?pa=a@b")).toBe("500");
    expect(extractRequestAmount(":TXT Pay Rs 2 upi://pay?pa=a@b")).toBe("2");
  });

  test("returns null when no amount is present", () => {
    expect(extractRequestAmount(":txt Pay upi://pay?pa=a@b")).toBe(null);
    expect(extractRequestAmount("Hello friend")).toBe(null);
    expect(extractRequestAmount("")).toBe(null);
    expect(extractRequestAmount(null)).toBe(null);
  });
});

describe("buildMobilePaymentLink", () => {
  test("creates a minimal link for a 10-digit mobile number", () => {
    const res = buildMobilePaymentLink({
      mobileOrVpa: "9876543210@upi",
      amount: "250",
    });
    expect(res.valid).toBe(true);
    expect(res.vpa).toBe("9876543210@upi");
    expect(res.link).toBe("upi://pay?pa=9876543210@upi&cu=INR");
  });

  test("never writes the amount, name or note into the link", () => {
    const res = buildMobilePaymentLink({
      mobileOrVpa: "9876543210",
      amount: "250",
    });
    expect(res.valid).toBe(true);
    expect(res.link).toBe("upi://pay?pa=9876543210@upi&cu=INR");
    expect(res.link).not.toContain("am=");
    expect(res.amount).toBe("250");
  });

  test("strips country code and spaces from phone number", () => {
    const res = buildMobilePaymentLink({
      mobileOrVpa: "+91 98765 43210",
    });
    expect(res.valid).toBe(true);
    expect(res.vpa).toBe("9876543210@upi");
    expect(res.link).toBe("upi://pay?pa=9876543210@upi&cu=INR");
  });

  test("accepts a standard UPI ID / VPA without extra parameters", () => {
    const res = buildMobilePaymentLink({
      mobileOrVpa: "someone@okhdfcbank",
    });
    expect(res.valid).toBe(true);
    expect(res.vpa).toBe("someone@okhdfcbank");
    expect(res.link).toBe("upi://pay?pa=someone@okhdfcbank&cu=INR");
  });


  test("normalises an optional amount for the SMS text without linking it", () => {
    const res = buildMobilePaymentLink({ mobileOrVpa: "9876543210", amount: "2" });
    expect(res.link).not.toContain("am=");
    expect(res.amount).toBe("2");
    expect(buildMobilePaymentLink({ mobileOrVpa: "9876543210" }).amount).toBe(null);
  });

  test("rejects invalid mobile numbers and VPAs", () => {
    expect(buildMobilePaymentLink({ mobileOrVpa: "12345" }).valid).toBe(false);
    expect(buildMobilePaymentLink({ mobileOrVpa: "invalid@vpa@wrong" }).valid).toBe(false);
    expect(buildMobilePaymentLink({ mobileOrVpa: "" }).valid).toBe(false);
  });
});
