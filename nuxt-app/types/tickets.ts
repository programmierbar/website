// Ticket system types

export type TicketOrderStatus = 'pending' | 'paid' | 'cancelled'
export type TicketStatus = 'valid' | 'checked_in' | 'cancelled'
export type TicketType = 'early_bird' | 'regular' | 'discounted'
export type PurchaseType = 'personal' | 'company'

// Directus collection types (raw from CMS)
export interface DirectusTicketOrderItem {
    id: string
    order_number: string
    conference: string // Reference to conference ID
    status: TicketOrderStatus
    purchase_type: PurchaseType
    purchaser_first_name: string
    purchaser_last_name: string
    purchaser_email: string
    company_name: string | null
    billing_address_line1: string | null
    billing_address_line2: string | null
    billing_city: string | null
    billing_postal_code: string | null
    billing_country: string | null
    billing_email: string | null
    subtotal_cents: number
    discount_amount_cents: number
    total_cents: number
    discount_code_used: string | null
    stripe_checkout_session_id: string
    stripe_payment_intent_id: string | null
    date_created: string
    date_paid: string | null
}

export interface DirectusTicketItem {
    id: string
    ticket_code: string
    order: string // Reference to ticket_order ID
    conference: string // Reference to conference ID
    attendee_first_name: string
    attendee_last_name: string
    attendee_email: string
    ticket_type: TicketType
    price_cents: number
    status: TicketStatus
    checked_in_at: string | null
    date_created: string
}

export interface DirectusTicketSettingsItem {
    id: number
    early_bird_price_cents: number
    regular_price_cents: number
    discounted_price_cents: number
    early_bird_deadline: string
    discount_code: string | null
}

// Frontend types for checkout flow
export interface TicketAttendee {
    firstName: string
    lastName: string
    email: string
}

export interface BillingAddress {
    line1: string
    line2?: string
    city: string
    postalCode: string
    country: string
}

export interface CompanyBillingInfo {
    name: string
    address: BillingAddress
    billingEmail?: string
}

export interface Purchaser {
    firstName: string
    lastName: string
    email: string
}

// API request/response types
export interface CreateCheckoutRequest {
    conferenceId: string
    purchaseType: PurchaseType
    purchaser: Purchaser
    company?: CompanyBillingInfo
    personalAddress?: BillingAddress
    tickets: TicketAttendee[]
    discountCode?: string
}

export interface CreateCheckoutResponse {
    checkoutUrl: string
    orderId: string
}

export interface ValidateDiscountRequest {
    code: string
    conferenceId: string
}

export interface ValidateDiscountResponse {
    valid: boolean
    discountAmountCents?: number
    message?: string
}
