import { z } from 'zod'

export const EmailSchema = z.object({
    name: z
        .string()
        .min(1, 'Bitte trage deinen Namen ein.')
        .max(50, 'Dein Name darf nicht länger als 50 Zeichen lang sein.'),
    email: z
        .string()
        .email('Deine E-Mail-Adresse scheint ungültig zu sein.')
        .max(50, 'Deine E-Mail-Adresse darf nicht länger als 50 Zeichen lang sein.'),
    message: z
        .string()
        .min(50, 'Deine Nachricht muss mindestens 50 Zeichen lang sein.')
        .max(1000, 'Deine Nachricht darf nicht länger als 1.000 Zeichen lang sein.'),
})

// Speaker portal submission

export const SpeakerSubmissionSchema = z.object({
    academic_title: z.string().max(50).optional().nullable(),
    first_name: z.string().min(1, 'Vorname ist erforderlich').max(100),
    last_name: z.string().min(1, 'Nachname ist erforderlich').max(100),
    occupation: z.string().min(1, 'Jobtitel und Unternehmen sind erforderlich').max(200),
    description: z.string().min(1, 'Beschreibung ist erforderlich').max(2000),
    website_url: z.string().url().max(500).optional().or(z.literal('')),
    linkedin_url: z.string().url().max(500).optional().or(z.literal('')),
    twitter_url: z.string().url().max(500).optional().or(z.literal('')),
    bluesky_url: z.string().max(100).optional().or(z.literal('')),
    github_url: z.string().url().max(500).optional().or(z.literal('')),
    instagram_url: z.string().url().max(500).optional().or(z.literal('')),
    youtube_url: z.string().url().max(500).optional().or(z.literal('')),
    mastodon_url: z.string().url().max(500).optional().or(z.literal('')),
})

// Ticket checkout

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

export const OptionalBillingAddressSchema = z.object({
    line1: z.string().max(200, 'Die Adresszeile darf nicht länger als 200 Zeichen sein.').optional(),
    line2: z.string().max(200, 'Die Adresszeile darf nicht länger als 200 Zeichen sein.').optional(),
    city: z.string().max(100, 'Die Stadt darf nicht länger als 100 Zeichen sein.').optional(),
    postalCode: z.string().max(20, 'Die Postleitzahl darf nicht länger als 20 Zeichen sein.').optional(),
    country: z.string().max(100, 'Das Land darf nicht länger als 100 Zeichen sein.').optional(),
})

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

export const ValidateDiscountSchema = z.object({
    code: z.string().min(1, 'Bitte trage einen Rabattcode ein.').max(50),
})

export type CreateCheckoutInput = z.infer<typeof CreateCheckoutSchema>
export type TicketAttendeeInput = z.infer<typeof TicketAttendeeSchema>
