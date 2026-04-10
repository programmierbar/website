import { defineStore } from 'pinia'
import { VAT_RATE } from '~/config'
import type { TicketAttendee, CompanyBillingInfo, BillingAddress, Purchaser } from '~/types/items'
import type { PurchaseType, TicketType } from '~/types/directus'

interface TicketPricingSettings {
    earlyBirdPriceCents: number | null
    regularPriceCents: number | null
    earlyBirdDeadline: string | null
    isEarlyBird: boolean
    discountPriceCents: number | null
    discountLabel: string | null
}

interface TicketCheckoutState {
    conferenceId: string
    conferenceSlug: string
    conferenceTitle: string
    ticketCount: number
    attendees: TicketAttendee[]
    purchaser: Purchaser
    purchaseType: PurchaseType
    company: CompanyBillingInfo | null
    showPersonalAddress: boolean
    personalAddress: BillingAddress | null
    discountCode: string
    discountValid: boolean
    discountValidating: boolean
    isLoading: boolean
    error: string | null
    // Pricing settings from Directus
    pricingSettings: TicketPricingSettings | null
    pricingLoaded: boolean
    pricingError: boolean
}

// Keys to persist (exclude transient state like isLoading, error, discountValidating)
const PERSISTED_KEYS: (keyof TicketCheckoutState)[] = [
    'conferenceId',
    'conferenceSlug',
    'conferenceTitle',
    'ticketCount',
    'attendees',
    'purchaser',
    'purchaseType',
    'company',
    'showPersonalAddress',
    'personalAddress',
    'discountCode',
    'discountValid',
]

function getStorageKey(conferenceSlug: string): string {
    return `ticket-checkout-${conferenceSlug}`
}

function loadFromStorage(conferenceSlug: string): Partial<TicketCheckoutState> | null {
    if (typeof window === 'undefined') return null
    try {
        const stored = localStorage.getItem(getStorageKey(conferenceSlug))
        if (stored) {
            return JSON.parse(stored)
        }
    } catch (e) {
        console.warn('Failed to load checkout state from localStorage', e)
    }
    return null
}

function saveToStorage(state: TicketCheckoutState): void {
    if (typeof window === 'undefined') return
    if (!state.conferenceSlug) return

    try {
        const toSave: Partial<TicketCheckoutState> = {}
        for (const key of PERSISTED_KEYS) {
            ;(toSave as any)[key] = state[key]
        }
        localStorage.setItem(getStorageKey(state.conferenceSlug), JSON.stringify(toSave))
    } catch (e) {
        console.warn('Failed to save checkout state to localStorage', e)
    }
}

function clearStorage(conferenceSlug: string): void {
    if (typeof window === 'undefined') return
    try {
        localStorage.removeItem(getStorageKey(conferenceSlug))
    } catch (e) {
        console.warn('Failed to clear checkout state from localStorage', e)
    }
}

export const useTicketCheckoutStore = defineStore('ticketCheckout', {
    state: (): TicketCheckoutState => ({
        conferenceId: '',
        conferenceSlug: '',
        conferenceTitle: '',
        ticketCount: 1,
        attendees: [{ firstName: '', lastName: '', email: '' }],
        purchaser: { firstName: '', lastName: '', email: '' },
        purchaseType: 'personal',
        company: null,
        showPersonalAddress: false,
        personalAddress: null,
        discountCode: '',
        discountValid: false,
        discountValidating: false,
        isLoading: false,
        error: null,
        pricingSettings: null,
        pricingLoaded: false,
        pricingError: false,
    }),

    getters: {
        /**
         * Check if pricing settings failed to load
         */
        hasPricingError(): boolean {
            return this.pricingError
        },

        /**
         * Check if we're in early bird period
         */
        isEarlyBird(): boolean {
            if (!this.pricingSettings) {
                return false
            }
            return this.pricingSettings.isEarlyBird
        },

        /**
         * Base price per ticket (before any discount) in cents
         */
        basePriceCents(): number {
            if (!this.pricingSettings) {
                return 0
            }
            if (this.isEarlyBird && this.pricingSettings.earlyBirdPriceCents) {
                return this.pricingSettings.earlyBirdPriceCents
            }
            return this.pricingSettings.regularPriceCents ?? 0
        },

        /**
         * Effective unit price per ticket in cents (after discount if applicable)
         */
        unitPriceCents(): number {
            if (this.discountValid && !this.isEarlyBird && this.pricingSettings?.discountPriceCents !== null && this.pricingSettings?.discountPriceCents !== undefined) {
                return this.pricingSettings.discountPriceCents
            }
            return this.basePriceCents
        },

        /**
         * Get ticket type based on current pricing
         */
        ticketType(): TicketType {
            if (this.isEarlyBird) {
                return 'early_bird'
            }
            if (this.discountValid) {
                return 'discounted'
            }
            return 'regular'
        },

        /**
         * Calculate subtotal in cents (based on base price, before discount)
         */
        subtotalCents(): number {
            return this.ticketCount * this.basePriceCents
        },

        /**
         * Calculate discount amount in cents
         */
        discountAmountCents(): number {
            if (!this.discountValid || this.isEarlyBird || !this.pricingSettings || this.pricingSettings.discountPriceCents === null) {
                return 0
            }
            return this.ticketCount * (this.basePriceCents - this.pricingSettings.discountPriceCents)
        },

        /**
         * Calculate total (net) in cents
         */
        totalCents(): number {
            return this.subtotalCents - this.discountAmountCents
        },

        /**
         * VAT rate (from config)
         */
        vatRate(): number {
            return VAT_RATE
        },

        /**
         * Calculate VAT amount in cents
         */
        vatAmountCents(): number {
            return Math.round(this.totalCents * this.vatRate)
        },

        /**
         * Calculate total with VAT (gross) in cents
         */
        totalWithVatCents(): number {
            return this.totalCents + this.vatAmountCents
        },

        /**
         * Format price in euros
         */
        formatPrice:
            () =>
            (cents: number): string => {
                return new Intl.NumberFormat('de-DE', {
                    style: 'currency',
                    currency: 'EUR',
                }).format(cents / 100)
            },
    },

    actions: {
        /**
         * Set pricing settings from conference data
         */
        setPricingSettings(settings: {
            ticket_early_bird_price_cents: number | null
            ticket_regular_price_cents: number | null
            ticket_early_bird_deadline: string | null
        } | null | undefined) {
            if (!settings || settings.ticket_regular_price_cents === null) {
                this.pricingError = true
                this.error = 'Preise konnten nicht geladen werden. Bitte versuche es später erneut.'
                return
            }

            const isEarlyBird = settings.ticket_early_bird_deadline
                ? new Date() <= new Date(settings.ticket_early_bird_deadline)
                : false

            this.pricingSettings = {
                earlyBirdPriceCents: settings.ticket_early_bird_price_cents,
                regularPriceCents: settings.ticket_regular_price_cents,
                earlyBirdDeadline: settings.ticket_early_bird_deadline,
                isEarlyBird,
                discountPriceCents: null,
                discountLabel: null,
            }
            this.pricingLoaded = true
            this.pricingError = false
        },

        /**
         * Initialize the store with conference data, loading from localStorage if available
         */
        initConference(
            id: string,
            slug: string,
            title: string,
            preloadedSettings?: {
                ticket_early_bird_price_cents: number | null
                ticket_regular_price_cents: number | null
                ticket_early_bird_deadline: string | null
            } | null
        ) {
            // Use pre-fetched settings if available (from SSR/SSG)
            if (preloadedSettings && !this.pricingLoaded) {
                this.setPricingSettings(preloadedSettings)
            }

            // Try to load existing state from localStorage
            const stored = loadFromStorage(slug)

            if (stored && stored.conferenceSlug === slug) {
                // Restore persisted state
                this.conferenceId = stored.conferenceId
                this.conferenceSlug = stored.conferenceSlug || slug
                this.conferenceTitle = stored.conferenceTitle || title
                this.ticketCount = stored.ticketCount || 1
                this.attendees = stored.attendees || [{ firstName: '', lastName: '', email: '' }]
                this.purchaser = stored.purchaser || { firstName: '', lastName: '', email: '' }
                this.purchaseType = stored.purchaseType || 'personal'
                this.company = stored.company || null
                this.showPersonalAddress = stored.showPersonalAddress || false
                this.personalAddress = stored.personalAddress || null
                this.discountCode = stored.discountCode || ''
                this.discountValid = false

                // Re-validate discount code if one was persisted
                if (stored.discountValid && stored.discountCode) {
                    this.validateDiscountCode()
                }
            } else {
                // Initialize fresh state
                this.conferenceId = id
                this.conferenceSlug = slug
                this.conferenceTitle = title
            }
        },

        /**
         * Persist current state to localStorage
         */
        persistState() {
            saveToStorage(this.$state)
        },

        /**
         * Set ticket count and sync attendees array
         */
        setTicketCount(count: number) {
            const validCount = Math.max(1, Math.min(10, count))
            this.ticketCount = validCount

            // Sync attendees array with ticket count
            while (this.attendees.length < validCount) {
                this.attendees.push({ firstName: '', lastName: '', email: '' })
            }
            while (this.attendees.length > validCount) {
                this.attendees.pop()
            }

            this.persistState()
        },

        /**
         * Update a specific attendee
         */
        updateAttendee(index: number, data: Partial<TicketAttendee>) {
            if (index >= 0 && index < this.attendees.length) {
                this.attendees[index] = { ...this.attendees[index], ...data }
                this.persistState()
            }
        },

        /**
         * Copy purchaser info to first attendee
         */
        copyPurchaserToFirstAttendee() {
            if (this.attendees.length > 0) {
                this.attendees[0] = { ...this.purchaser }
                this.persistState()
            }
        },

        /**
         * Copy first attendee info to purchaser
         */
        copyFirstAttendeeToPurchaser() {
            if (this.attendees.length > 0 && this.attendees[0]) {
                this.purchaser = { ...this.attendees[0] }
                this.persistState()
            }
        },

        /**
         * Update purchaser info
         */
        updatePurchaser(data: Partial<Purchaser>) {
            this.purchaser = { ...this.purchaser, ...data }
            this.persistState()
        },

        /**
         * Set purchase type
         */
        setPurchaseType(type: PurchaseType) {
            this.purchaseType = type
            if (type === 'personal') {
                this.company = null
            } else if (!this.company) {
                this.company = {
                    name: '',
                    address: {
                        line1: '',
                        city: '',
                        postalCode: '',
                        country: 'Deutschland',
                    },
                }
            }
            this.persistState()
        },

        /**
         * Update company info
         */
        updateCompany(data: Partial<CompanyBillingInfo>) {
            if (this.company) {
                this.company = { ...this.company, ...data }
                this.persistState()
            }
        },

        /**
         * Toggle personal address section
         */
        setShowPersonalAddress(show: boolean) {
            this.showPersonalAddress = show
            if (show && !this.personalAddress) {
                this.personalAddress = {
                    line1: '',
                    city: '',
                    postalCode: '',
                    country: 'Deutschland',
                }
            } else if (!show) {
                this.personalAddress = null
            }
            this.persistState()
        },

        /**
         * Update personal address
         */
        updatePersonalAddress(data: Partial<BillingAddress>) {
            if (this.personalAddress) {
                this.personalAddress = { ...this.personalAddress, ...data }
                this.persistState()
            }
        },

        /**
         * Set discount code
         */
        setDiscountCode(code: string) {
            this.discountCode = code
            this.discountValid = false
            this.persistState()
        },

        /**
         * Validate discount code
         */
        async validateDiscountCode(): Promise<boolean> {
            if (!this.discountCode.trim()) {
                this.discountValid = false
                return false
            }

            this.discountValidating = true
            this.error = null

            try {
                const response = await $fetch('/api/tickets/validate-discount', {
                    method: 'POST',
                    body: {
                        code: this.discountCode.trim(),
                        conferenceId: this.conferenceId,
                    },
                })

                const result = response as { valid: boolean; discountPriceCents?: number; discountLabel?: string }
                this.discountValid = result.valid

                if (result.valid && this.pricingSettings) {
                    this.pricingSettings.discountPriceCents = result.discountPriceCents ?? null
                    this.pricingSettings.discountLabel = result.discountLabel ?? null
                }

                this.persistState()
                return this.discountValid
            } catch (e: any) {
                this.discountValid = false
                this.error = e.data?.message || 'Fehler bei der Code-Validierung'
                return false
            } finally {
                this.discountValidating = false
            }
        },

        /**
         * Create Stripe checkout session and return URL
         */
        async createCheckout(): Promise<string> {
            this.isLoading = true
            this.error = null

            try {
                const response = await $fetch('/api/tickets/create-checkout', {
                    method: 'POST',
                    body: {
                        conferenceId: this.conferenceId,
                        purchaseType: this.purchaseType,
                        purchaser: this.purchaser,
                        company: this.purchaseType === 'company' ? this.company : undefined,
                        personalAddress:
                            this.purchaseType === 'personal' && this.showPersonalAddress
                                ? this.personalAddress
                                : undefined,
                        tickets: this.attendees,
                        discountCode: this.discountValid ? this.discountCode : undefined,
                    },
                })

                return (response as { checkoutUrl: string }).checkoutUrl
            } catch (e: any) {
                this.error = e.data?.message || 'Fehler beim Erstellen der Bestellung'
                throw e
            } finally {
                this.isLoading = false
            }
        },

        /**
         * Reset the store to initial state and clear localStorage
         */
        reset() {
            const conferenceSlug = this.conferenceSlug
            this.$reset()
            if (conferenceSlug) {
                clearStorage(conferenceSlug)
            }
        },

        /**
         * Reset and clear storage using a specific slug (for use when store isn't initialized)
         */
        resetBySlug(slug: string) {
            this.$reset()
            if (slug) {
                clearStorage(slug)
            }
        },

        /**
         * Clear persisted data for current conference
         */
        clearPersistedData() {
            if (this.conferenceSlug) {
                clearStorage(this.conferenceSlug)
            }
        },
    },
})
