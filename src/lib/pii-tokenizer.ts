import type { Segment } from "@/types/evidence";

/**
 * Request-scoped reversible protection for common direct identifiers.
 *
 * The model needs the legal meaning of a passage, not the original email,
 * phone number, or account identifier. Tokens preserve the text shape while
 * keeping the original values available only inside this request. The vault
 * is never serialized, logged, or reused between requests.
 */
export class PiiTokenVault {
  private readonly values = new Map<string, string>();
  private readonly tokens = new Map<string, string>();
  private readonly counters = new Map<PiiKind, number>();

  protectText(text: string): string {
    let protectedText = text;

    protectedText = this.replaceMatches(protectedText, "email", EMAIL_PATTERN);
    protectedText = this.replaceMatches(protectedText, "ssn", SSN_PATTERN);
    protectedText = this.replaceMatches(protectedText, "phone", PHONE_PATTERN);
    protectedText = this.replaceMatches(
      protectedText,
      "identity",
      LABELLED_IDENTIFIER_PATTERN,
      isLikelyLabelledIdentifier,
    );
    protectedText = this.replaceMatches(
      protectedText,
      "card",
      PAYMENT_CARD_PATTERN,
      isLikelyPaymentCard,
    );
    protectedText = this.replaceMatches(protectedText, "ip", IP_ADDRESS_PATTERN);

    return protectedText;
  }

  protectSegments(segments: Segment[]): Segment[] {
    return segments.map((segment) => ({
      ...segment,
      heading: segment.heading ? this.protectText(segment.heading) : segment.heading,
      text: this.protectText(segment.text),
    }));
  }

  restoreText(text: string): string {
    let restored = text;
    for (const [token, value] of this.tokens) {
      restored = restored.split(token).join(value);
    }
    return restored;
  }

  /** Restore provider-generated JSON without trusting any provider-authored evidence. */
  restoreValue<T>(value: T): T {
    if (typeof value === "string") return this.restoreText(value) as T;
    if (Array.isArray(value)) return value.map((item) => this.restoreValue(item)) as T;
    if (value && typeof value === "object") {
      const restored = Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, this.restoreValue(item)]),
      );
      return restored as T;
    }
    return value;
  }

  private replaceMatches(
    text: string,
    kind: PiiKind,
    pattern: RegExp,
    predicate: (value: string) => boolean = () => true,
  ): string {
    return text.replace(pattern, (value) => {
      if (!predicate(value)) return value;
      return this.tokenFor(kind, value);
    });
  }

  private tokenFor(kind: PiiKind, value: string): string {
    const key = `${kind}\u0000${value}`;
    const existing = this.values.get(key);
    if (existing) return existing;

    const counter = (this.counters.get(kind) ?? 0) + 1;
    this.counters.set(kind, counter);
    const token = `[[CLAUSEORA_PII_${kind.toUpperCase()}_${counter}]]`;
    this.values.set(key, token);
    this.tokens.set(token, value);
    return token;
  }
}

type PiiKind = "email" | "ssn" | "phone" | "identity" | "card" | "ip";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
const PHONE_PATTERN = /(?<!\d)(?:\+?1[\s.-]?)?(?:\([2-9]\d{2}\)|[2-9]\d{2})[\s.-]\d{3}[\s.-]\d{4}(?!\d)/g;
const LABELLED_IDENTIFIER_PATTERN =
  /\b(?:ssn|social security(?: number)?|passport(?: number)?|driver(?:'s)? license|account(?: number)?|routing(?: number)?|iban|tax id)\b(?:\s*(?:number|no\.?|#))?\s*(?:is|:|#|-)?\s*[A-Z0-9][A-Z0-9-]{3,30}\b/gi;
const PAYMENT_CARD_PATTERN = /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g;
const IP_ADDRESS_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

function isLikelyPaymentCard(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

function isLikelyLabelledIdentifier(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  const compact = value.replace(/\s/g, "");
  return digits.length >= 4 || /[A-Z]\d|\d[A-Z]/i.test(compact);
}
