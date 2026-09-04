/**
 * Supported payment countries for the Relworx backend.
 *
 * Plan prices are authored in UGX; every other country sees the same plan
 * converted into its own currency, rounded to a friendly amount and clamped
 * into the mobile-money limits the backend enforces.
 */

export type CountryInfo = {
  code: string;
  name: string;
  short: string;
  flag: string;
  currency: string;
  /** How much 1 UGX is worth in this currency. */
  rate: number;
  /** Rounding step used when converting a UGX price. */
  step: number;
  dial: string;
  /** National number length after the dial code. */
  localLength: number;
  min: number;
  max: number;
  providers: string[];
};

export const COUNTRIES: CountryInfo[] = [
  {
    code: "UG",
    name: "Uganda",
    short: "UG",
    flag: "🇺🇬",
    currency: "UGX",
    rate: 1,
    step: 500,
    dial: "256",
    localLength: 9,
    min: 500,
    max: 5_000_000,
    providers: ["MTN MoMo", "Airtel Money"],
  },
  {
    code: "KE",
    name: "Kenya",
    short: "KE",
    flag: "🇰🇪",
    currency: "KES",
    rate: 0.0351,
    step: 10,
    dial: "254",
    localLength: 9,
    min: 10,
    max: 70_000,
    providers: ["M-Pesa", "Airtel Money"],
  },
  {
    code: "TZ",
    name: "Tanzania",
    short: "TZ",
    flag: "🇹🇿",
    currency: "TZS",
    rate: 0.7,
    step: 500,
    dial: "255",
    localLength: 9,
    min: 500,
    max: 5_000_000,
    providers: ["Vodacom", "Airtel", "Tigo", "Halotel"],
  },
  {
    code: "RW",
    name: "Rwanda",
    short: "RW",
    flag: "🇷🇼",
    currency: "RWF",
    rate: 0.378,
    step: 100,
    dial: "250",
    localLength: 9,
    min: 100,
    max: 5_000_000,
    providers: ["MTN MoMo", "Airtel Money"],
  },
  {
    code: "CD",
    name: "DR Congo",
    short: "CD",
    flag: "🇨🇩",
    currency: "CDF",
    rate: 0.77,
    step: 500,
    dial: "243",
    localLength: 9,
    min: 500,
    max: 5_000_000,
    providers: ["Airtel Money", "Orange Money", "M-Pesa", "Afrimoney"],
  },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]!;

export function countryByCode(code?: string | null) {
  return COUNTRIES.find((c) => c.code === String(code ?? "").toUpperCase()) ?? DEFAULT_COUNTRY;
}

export function countryByCurrency(currency?: string | null) {
  return (
    COUNTRIES.find((c) => c.currency === String(currency ?? "").toUpperCase()) ?? DEFAULT_COUNTRY
  );
}

/** Detects the country from an international/local phone number. */
export function countryFromPhone(input: string): CountryInfo | null {
  const digits = (input ?? "").replace(/[^0-9]/g, "");
  return COUNTRIES.find((c) => digits.startsWith(c.dial)) ?? null;
}

/** Converts a UGX plan price into the country's currency (rounded + clamped). */
export function convertPrice(ugx: number, country: CountryInfo) {
  const raw = Number(ugx || 0) * country.rate;
  const rounded = Math.max(country.step, Math.round(raw / country.step) * country.step);
  return Math.min(Math.max(rounded, country.min), country.max);
}

/** Flags a converted amount that falls outside the provider limits. */
export function priceNotice(amount: number, country: CountryInfo): "low" | "high" | null {
  if (amount < country.min) return "low";
  if (amount > country.max) return "high";
  return null;
}

export function formatAmount(amount: number, currency: string) {
  return `${currency} ${Math.round(Number(amount) || 0).toLocaleString("en-US")}`;
}

/** Normalises a local number into +<dial><national> for the chosen country. */
export function normalizeFor(input: string, country: CountryInfo) {
  let d = (input ?? "").replace(/[^0-9]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith(country.dial)) return `+${d}`;
  if (d.startsWith("0")) d = d.slice(1);
  return `+${country.dial}${d}`;
}

export function isValidFor(input: string, country: CountryInfo) {
  const msisdn = normalizeFor(input, country);
  return new RegExp(`^\\+${country.dial}\\d{${country.localLength}}$`).test(msisdn);
}

/** CDN flag image for a country (used where the emoji flag renders poorly). */
export function flagUrl(country: CountryInfo, width: 20 | 40 | 80 = 40) {
  return `https://flagcdn.com/w${width}/${country.code.toLowerCase()}.png`;
}

/** Human phone format hint, e.g. "+256 7XX XXX XXX". */
export function phoneFormat(country: CountryInfo) {
  const body = "X".repeat(country.localLength).replace(/^X/, "7");
  const grouped = body.match(/.{1,3}/g)?.join(" ") ?? body;
  return `+${country.dial} ${grouped}`;
}
