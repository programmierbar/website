/**
 * Billing countries of ticket orders, shared so the checkout (select options,
 * request validation) and the CMS (invoice rendering) agree on the codes.
 *
 * `ticket_orders.billing_country` stores an ISO 3166-1 alpha-2 code (e.g.
 * "DE"), which e-invoices (ZUGFeRD / EN 16931) require for the buyer. Orders
 * placed before the checkout offered a select hold free text ("Deutschland",
 * "Germany", ...); `normalizeBillingCountry` maps those to a code and
 * `formatBillingCountry` keeps printing them as they were entered.
 */

export interface BillingCountry {
  code: string;
  /** German name, as printed on invoices and shown in the checkout. */
  name: string;
  /** Further spellings seen in free-text input (lower-cased on comparison). */
  aliases: readonly string[];
}

/** EU/EEA plus Switzerland, the UK and the US, sorted by German name. */
export const BILLING_COUNTRIES = [
  { code: 'BE', name: 'Belgien', aliases: ['Belgium'] },
  { code: 'BG', name: 'Bulgarien', aliases: ['Bulgaria'] },
  { code: 'DK', name: 'Dänemark', aliases: ['Denmark'] },
  { code: 'DE', name: 'Deutschland', aliases: ['Germany', 'Bundesrepublik Deutschland'] },
  { code: 'EE', name: 'Estland', aliases: ['Estonia'] },
  { code: 'FI', name: 'Finnland', aliases: ['Finland'] },
  { code: 'FR', name: 'Frankreich', aliases: ['France'] },
  { code: 'GR', name: 'Griechenland', aliases: ['Greece'] },
  { code: 'IE', name: 'Irland', aliases: ['Ireland'] },
  { code: 'IS', name: 'Island', aliases: ['Iceland'] },
  { code: 'IT', name: 'Italien', aliases: ['Italy'] },
  { code: 'HR', name: 'Kroatien', aliases: ['Croatia'] },
  { code: 'LV', name: 'Lettland', aliases: ['Latvia'] },
  { code: 'LI', name: 'Liechtenstein', aliases: [] },
  { code: 'LT', name: 'Litauen', aliases: ['Lithuania'] },
  { code: 'LU', name: 'Luxemburg', aliases: ['Luxembourg'] },
  { code: 'MT', name: 'Malta', aliases: [] },
  { code: 'NL', name: 'Niederlande', aliases: ['Netherlands', 'The Netherlands', 'Holland'] },
  { code: 'NO', name: 'Norwegen', aliases: ['Norway'] },
  { code: 'AT', name: 'Österreich', aliases: ['Austria'] },
  { code: 'PL', name: 'Polen', aliases: ['Poland'] },
  { code: 'PT', name: 'Portugal', aliases: [] },
  { code: 'RO', name: 'Rumänien', aliases: ['Romania'] },
  { code: 'SE', name: 'Schweden', aliases: ['Sweden'] },
  { code: 'CH', name: 'Schweiz', aliases: ['Switzerland'] },
  { code: 'SK', name: 'Slowakei', aliases: ['Slovakia'] },
  { code: 'SI', name: 'Slowenien', aliases: ['Slovenia'] },
  { code: 'ES', name: 'Spanien', aliases: ['Spain'] },
  { code: 'CZ', name: 'Tschechien', aliases: ['Czechia', 'Czech Republic', 'Tschechische Republik'] },
  { code: 'HU', name: 'Ungarn', aliases: ['Hungary'] },
  { code: 'US', name: 'Vereinigte Staaten', aliases: ['United States', 'USA', 'Vereinigte Staaten von Amerika'] },
  {
    code: 'GB',
    name: 'Vereinigtes Königreich',
    aliases: ['United Kingdom', 'UK', 'Großbritannien', 'Great Britain'],
  },
  { code: 'CY', name: 'Zypern', aliases: ['Cyprus'] },
] as const satisfies readonly BillingCountry[];

export type BillingCountryCode = (typeof BILLING_COUNTRIES)[number]['code'];

export const BILLING_COUNTRY_CODES = BILLING_COUNTRIES.map((country) => country.code) as [
  BillingCountryCode,
  ...BillingCountryCode[],
];

/** Preselected in the checkout. */
export const DEFAULT_BILLING_COUNTRY: BillingCountryCode = 'DE';

function toLookupKey(value: string) {
  return value.normalize('NFC').trim().toLocaleLowerCase('de');
}

const COUNTRY_BY_KEY = new Map<string, BillingCountryCode>();
for (const country of BILLING_COUNTRIES) {
  for (const spelling of [country.code, country.name, ...country.aliases]) {
    COUNTRY_BY_KEY.set(toLookupKey(spelling), country.code);
  }
}

export function isBillingCountryCode(value: unknown): value is BillingCountryCode {
  return typeof value === 'string' && (BILLING_COUNTRY_CODES as readonly string[]).includes(value);
}

/**
 * Map a stored or typed country to its ISO code, case-insensitively:
 * "DE", "de", "Deutschland" and "Germany" all give "DE".
 *
 * @returns `undefined` for empty input and for values it does not know; the
 *   caller decides whether that is an error.
 */
export function normalizeBillingCountry(value: string | null | undefined): BillingCountryCode | undefined {
  if (!value) return undefined;
  return COUNTRY_BY_KEY.get(toLookupKey(value));
}

/** German name for a code, e.g. "AT" → "Österreich". */
export function getBillingCountryName(code: string): string | undefined {
  return BILLING_COUNTRIES.find((country) => country.code === code)?.name;
}

/**
 * The country line for an invoice address: a code is printed as its German
 * name, legacy free text exactly as it was entered.
 */
export function formatBillingCountry(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return getBillingCountryName(trimmed) ?? trimmed;
}
