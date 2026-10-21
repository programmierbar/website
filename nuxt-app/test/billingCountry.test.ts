import {
    BILLING_COUNTRIES,
    BILLING_COUNTRY_CODES,
    DEFAULT_BILLING_COUNTRY,
    formatBillingCountry,
    getBillingCountryName,
    isBillingCountryCode,
    normalizeBillingCountry,
} from 'shared-code'
import { describe, expect, it } from 'vitest'
import { BillingAddressSchema, CreateCheckoutSchema, OptionalBillingAddressSchema } from '../server/utils/schema'

describe('normalizeBillingCountry', () => {
    it.each([
        ['Deutschland', 'DE'],
        ['deutschland', 'DE'],
        ['Germany', 'DE'],
        ['DE', 'DE'],
        ['de', 'DE'],
        ['  Deutschland ', 'DE'],
        ['Österreich', 'AT'],
        ['österreich', 'AT'],
        // Decomposed "Ö" (O + combining diaeresis), as some keyboards/OSes send it.
        ['Österreich', 'AT'],
        ['Austria', 'AT'],
        ['AT', 'AT'],
        ['Schweiz', 'CH'],
        ['Switzerland', 'CH'],
        ['CH', 'CH'],
        ['United Kingdom', 'GB'],
        ['USA', 'US'],
    ])('maps %j to %s', (input, code) => {
        expect(normalizeBillingCountry(input)).toBe(code)
    })

    it.each([[''], ['   '], [null], [undefined]])('treats %j as not provided', (input) => {
        expect(normalizeBillingCountry(input)).toBeUndefined()
    })

    it('leaves unknown values to the caller', () => {
        expect(normalizeBillingCountry('Atlantis')).toBeUndefined()
        expect(normalizeBillingCountry('JP')).toBeUndefined()
    })
})

describe('getBillingCountryName / formatBillingCountry', () => {
    it('renders a code as its German name', () => {
        expect(getBillingCountryName('DE')).toBe('Deutschland')
        expect(getBillingCountryName('AT')).toBe('Österreich')
        expect(formatBillingCountry('CH')).toBe('Schweiz')
    })

    it('has no name for unknown codes', () => {
        expect(getBillingCountryName('XX')).toBeUndefined()
    })

    it('prints legacy free text as it was entered', () => {
        expect(formatBillingCountry('Germany')).toBe('Germany')
        expect(formatBillingCountry('Deutschland')).toBe('Deutschland')
        expect(formatBillingCountry(' Österreich ')).toBe('Österreich')
    })

    it('prints nothing for a missing country', () => {
        expect(formatBillingCountry(null)).toBeUndefined()
        expect(formatBillingCountry('')).toBeUndefined()
        expect(formatBillingCountry('  ')).toBeUndefined()
    })
})

describe('BILLING_COUNTRIES', () => {
    it('lists unique ISO 3166-1 alpha-2 codes', () => {
        expect(new Set(BILLING_COUNTRY_CODES).size).toBe(BILLING_COUNTRY_CODES.length)
        for (const code of BILLING_COUNTRY_CODES) {
            expect(code).toMatch(/^[A-Z]{2}$/)
        }
    })

    it('covers the EU/EEA, Switzerland, the UK and the US', () => {
        const eu = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU']
        const eu2 = ['IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK']
        expect([...BILLING_COUNTRY_CODES].sort()).toEqual([...eu, ...eu2, 'IS', 'LI', 'NO', 'CH', 'GB', 'US'].sort())
    })

    it('uses the German names Intl knows for each code', () => {
        const names = new Intl.DisplayNames(['de'], { type: 'region' })
        for (const country of BILLING_COUNTRIES) {
            expect(names.of(country.code)).toBe(country.name)
        }
    })

    it('is sorted by German name, as shown in the select', () => {
        const names = BILLING_COUNTRIES.map((country) => country.name)
        expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'de')))
    })

    it('defaults to Germany', () => {
        expect(DEFAULT_BILLING_COUNTRY).toBe('DE')
        expect(isBillingCountryCode(DEFAULT_BILLING_COUNTRY)).toBe(true)
        expect(isBillingCountryCode('Deutschland')).toBe(false)
    })
})

const address = { line1: 'Musterstraße 1', city: 'Berlin', postalCode: '10115' }

describe('BillingAddressSchema (company, all required)', () => {
    it('accepts a listed ISO code', () => {
        expect(BillingAddressSchema.safeParse({ ...address, country: 'DE' }).success).toBe(true)
        expect(BillingAddressSchema.safeParse({ ...address, country: 'AT' }).success).toBe(true)
    })

    it.each([['Deutschland'], ['de'], ['XX'], [''], [undefined]])('rejects country %j', (country) => {
        const result = BillingAddressSchema.safeParse({ ...address, country })
        expect(result.success).toBe(false)
        expect(result.error?.issues[0]?.path).toEqual(['country'])
    })
})

describe('OptionalBillingAddressSchema (personal, all optional)', () => {
    it('accepts a listed ISO code', () => {
        expect(OptionalBillingAddressSchema.parse({ country: 'CH' }).country).toBe('CH')
    })

    it('treats a missing or unselected country as not provided', () => {
        expect(OptionalBillingAddressSchema.parse({}).country).toBeUndefined()
        expect(OptionalBillingAddressSchema.parse({ country: '' }).country).toBeUndefined()
    })

    it.each([['Deutschland'], ['de'], ['XX']])('rejects country %j', (country) => {
        expect(OptionalBillingAddressSchema.safeParse({ country }).success).toBe(false)
    })
})

describe('CreateCheckoutSchema billing country', () => {
    const base = {
        conferenceId: '0b9e3c2e-6c8a-4b9e-9a51-3f2d8a7c1e10',
        purchaser: { firstName: 'Mika', lastName: 'Muster', email: 'mika@example.com' },
        tickets: [{ firstName: 'Mika', lastName: 'Muster', email: 'mika@example.com' }],
    }

    it('accepts a company order with an ISO code', () => {
        const result = CreateCheckoutSchema.safeParse({
            ...base,
            purchaseType: 'company',
            company: { name: 'Beispiel GmbH', address: { ...address, country: 'DE' } },
        })
        expect(result.success).toBe(true)
    })

    it('rejects a company order with a free-text country', () => {
        const result = CreateCheckoutSchema.safeParse({
            ...base,
            purchaseType: 'company',
            company: { name: 'Beispiel GmbH', address: { ...address, country: 'Deutschland' } },
        })
        expect(result.success).toBe(false)
        expect(result.error?.issues[0]?.path).toEqual(['company', 'address', 'country'])
    })

    it('accepts a personal order without an address', () => {
        expect(CreateCheckoutSchema.safeParse({ ...base, purchaseType: 'personal' }).success).toBe(true)
    })
})
