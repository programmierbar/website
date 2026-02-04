import { z } from 'zod'

// Attendee schema for individual ticket holders
export const TicketAttendeeSchema = z.object({
    firstName: z
        .string()
        .min(1, 'Bitte trage den Vornamen ein.')
        .max(100, 'Der Vorname darf nicht länger als 100 Zeichen sein.'),
    lastName: z
        .string()
        .min(1, 'Bitte trage den Nachnamen ein.')
        .max(100, 'Der Nachname darf nicht länger als 100 Zeichen sein.'),
    email: z
        .string()
        .email('Die E-Mail-Adresse scheint ungültig zu sein.')
        .max(200, 'Die E-Mail-Adresse darf nicht länger als 200 Zeichen sein.'),
})

// Purchaser schema (the person making the purchase)
export const PurchaserSchema = z.object({
    firstName: z
        .string()
        .min(1, 'Bitte trage deinen Vornamen ein.')
        .max(100, 'Dein Vorname darf nicht länger als 100 Zeichen sein.'),
    lastName: z
        .string()
        .min(1, 'Bitte trage deinen Nachnamen ein.')
        .max(100, 'Dein Nachname darf nicht länger als 100 Zeichen sein.'),
    email: z
        .string()
        .email('Deine E-Mail-Adresse scheint ungültig zu sein.')
        .max(200, 'Deine E-Mail-Adresse darf nicht länger als 200 Zeichen sein.'),
})

// Billing address schema for company purchases (all fields required)
export const BillingAddressSchema = z.object({
    line1: z
        .string()
        .min(1, 'Bitte trage die Straße und Hausnummer ein.')
        .max(200, 'Die Adresszeile darf nicht länger als 200 Zeichen sein.'),
    line2: z.string().max(200, 'Die Adresszeile darf nicht länger als 200 Zeichen sein.').optional(),
    city: z
        .string()
        .min(1, 'Bitte trage die Stadt ein.')
        .max(100, 'Die Stadt darf nicht länger als 100 Zeichen sein.'),
    postalCode: z
        .string()
        .min(1, 'Bitte trage die Postleitzahl ein.')
        .max(20, 'Die Postleitzahl darf nicht länger als 20 Zeichen sein.'),
    country: z
        .string()
        .min(1, 'Bitte trage das Land ein.')
        .max(100, 'Das Land darf nicht länger als 100 Zeichen sein.'),
})

// Optional billing address schema for personal purchases (all fields optional)
export const OptionalBillingAddressSchema = z.object({
    line1: z.string().max(200, 'Die Adresszeile darf nicht länger als 200 Zeichen sein.').optional(),
    line2: z.string().max(200, 'Die Adresszeile darf nicht länger als 200 Zeichen sein.').optional(),
    city: z.string().max(100, 'Die Stadt darf nicht länger als 100 Zeichen sein.').optional(),
    postalCode: z.string().max(20, 'Die Postleitzahl darf nicht länger als 20 Zeichen sein.').optional(),
    country: z.string().max(100, 'Das Land darf nicht länger als 100 Zeichen sein.').optional(),
})

// Company billing info schema
export const CompanyBillingSchema = z.object({
    name: z
        .string()
        .min(1, 'Bitte trage den Firmennamen ein.')
        .max(200, 'Der Firmenname darf nicht länger als 200 Zeichen sein.'),
    address: BillingAddressSchema,
    billingEmail: z
        .string()
        .email('Die Rechnungs-E-Mail-Adresse scheint ungültig zu sein.')
        .max(200, 'Die E-Mail-Adresse darf nicht länger als 200 Zeichen sein.')
        .optional(),
})

// Main checkout request schema
export const CreateCheckoutSchema = z
    .object({
        conferenceId: z.string().uuid('Ungültige Konferenz-ID.'),
        purchaseType: z.enum(['personal', 'company'], {
            errorMap: () => ({ message: 'Bitte wähle zwischen Privat oder Firma.' }),
        }),
        purchaser: PurchaserSchema,
        company: CompanyBillingSchema.optional(),
        personalAddress: OptionalBillingAddressSchema.optional(),
        tickets: z
            .array(TicketAttendeeSchema)
            .min(1, 'Mindestens ein Ticket muss ausgewählt werden.')
            .max(10, 'Maximal 10 Tickets pro Bestellung möglich.'),
        discountCode: z.string().max(50, 'Der Rabattcode darf nicht länger als 50 Zeichen sein.').optional(),
    })
    .refine(
        (data) => {
            // Company info is required when purchaseType is 'company'
            if (data.purchaseType === 'company') {
                return data.company !== undefined
            }
            return true
        },
        {
            message: 'Firmeninformationen sind bei Firmenkäufen erforderlich.',
            path: ['company'],
        }
    )

// Type exports inferred from schemas
export type CreateCheckoutInput = z.infer<typeof CreateCheckoutSchema>
export type TicketAttendeeInput = z.infer<typeof TicketAttendeeSchema>
