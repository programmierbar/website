import { defineStore } from 'pinia'
import type {
    TicketAttendee,
    CompanyBillingInfo,
    BillingAddress,
    Purchaser,
    PurchaseType,
    TicketType,
} from '~/types/tickets'

interface TicketPricingSettings {
    earlyBirdPriceCents: number
    regularPriceCents: number
    discountedPriceCents: number
    earlyBirdDeadline: string
    isEarlyBird: boolean
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
         * Get unit price per ticket in cents (returns 0 if settings not loaded)
         */
        unitPriceCents(): number {
            if (!this.pricingSettings) {
                return 0
            }
            if (this.isEarlyBird) {
                return this.pricingSettings.earlyBirdPriceCents
            }
            if (this.discountValid) {
                return this.pricingSettings.discountedPriceCents
            }
            return this.pricingSettings.regularPriceCents
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
         * Calculate subtotal in cents
         */
        subtotalCents(): number {
            return this.ticketCount * this.unitPriceCents
        },

        /**
         * Calculate discount amount in cents
         */
        discountAmountCents(): number {
            if (!this.discountValid || this.isEarlyBird || !this.pricingSettings) {
                return 0
            }
            return (
                this.ticketCount *
                (this.pricingSettings.regularPriceCents - this.pricingSettings.discountedPriceCents)
            )
        },

        /**
         * Calculate total (net) in cents
         */
        totalCents(): number {
            return this.subtotalCents - this.discountAmountCents
        },

        /**
         * VAT rate (19% in Germany)
         */
        vatRate(): number {
            return 0.19
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
         * Fetch pricing settings from the API
         */
        async fetchPricingSettings(): Promise<void> {
            if (this.pricingLoaded) return

            try {
                const settings = await $fetch('/api/tickets/settings')
                this.pricingSettings = settings as TicketPricingSettings
                this.pricingLoaded = true
                this.pricingError = false
            } catch (e) {
                console.error('Failed to fetch pricing settings', e)
                this.pricingError = true
                this.error = 'Preise konnten nicht geladen werden. Bitte versuche es später erneut.'
            }
        },

        /**
         * Set pricing settings from pre-fetched data (SSR/SSG)
         */
        setPricingSettings(settings: {
            early_bird_price_cents: number
            regular_price_cents: number
            discounted_price_cents: number
            early_bird_deadline: string
            discount_code: string | null
        } | null | undefined) {
            if (!settings) {
                this.pricingError = true
                this.error = 'Preise konnten nicht geladen werden. Bitte versuche es später erneut.'
                return
            }

            const deadline = new Date(settings.early_bird_deadline)
            const isEarlyBird = new Date() <= deadline

            this.pricingSettings = {
                earlyBirdPriceCents: settings.early_bird_price_cents,
                regularPriceCents: settings.regular_price_cents,
                discountedPriceCents: settings.discounted_price_cents,
                earlyBirdDeadline: settings.early_bird_deadline,
                isEarlyBird,
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
                early_bird_price_cents: number
                regular_price_cents: number
                discounted_price_cents: number
                early_bird_deadline: string
                discount_code: string | null
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
                this.discountValid = stored.discountValid || false
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
                    },
                })

                this.discountValid = (response as { valid: boolean }).valid
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
