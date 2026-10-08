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
        .max(2048, 'Deine Nachricht darf nicht länger als 2.048 Zeichen lang sein.'),
})

// Podcast vote (rating)

export const VoteSchema = z.object({
    slug: z.string().min(1, 'Slug ist erforderlich.'),
    direction: z.enum(['up', 'down']),
})

// Speaker portal submission

// Every rule carries a German message: the first failing one is shown to the speaker as-is.
const speakerText = (label: string, max: number) =>
    z
        .string({ error: `Bitte fülle das Feld „${label}“ aus.` })
        .max(max, `Das Feld „${label}“ darf höchstens ${max} Zeichen lang sein.`)

const requiredSpeakerText = (label: string, max: number) =>
    speakerText(label, max).min(1, `Bitte fülle das Feld „${label}“ aus.`)

const speakerUrl = (label: string) =>
    z
        .string({ error: `Bitte gib bei „${label}“ eine vollständige URL an, z. B. https://…` })
        .url(`Bitte gib bei „${label}“ eine vollständige URL an, z. B. https://…`)
        .max(500, `Die URL bei „${label}“ darf höchstens 500 Zeichen lang sein.`)
        .optional()
        .or(z.literal(''))

export const SpeakerSubmissionSchema = z.object({
    academic_title: speakerText('Akademischer Titel', 50).optional().nullable(),
    first_name: requiredSpeakerText('Vorname', 100),
    last_name: requiredSpeakerText('Nachname', 100),
    occupation: requiredSpeakerText('Jobtitel und Unternehmen', 200),
    description: requiredSpeakerText('Bio / Beschreibung', 2000),
    website_url: speakerUrl('Website'),
    linkedin_url: speakerUrl('LinkedIn'),
    twitter_url: speakerUrl('Twitter / X'),
    bluesky_url: speakerText('Bluesky', 100).optional().or(z.literal('')),
    github_url: speakerUrl('GitHub'),
    instagram_url: speakerUrl('Instagram'),
    youtube_url: speakerUrl('YouTube'),
    mastodon_url: speakerUrl('Mastodon'),
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
    city: z.string().min(1, 'Bitte trage die Stadt ein.').max(100, 'Die Stadt darf nicht länger als 100 Zeichen sein.'),
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
    // Treat a cleared (empty/whitespace-only) optional field as "not provided"
    // so it passes validation instead of failing the email check.
    billingEmail: z.preprocess(
        (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
        z
            .string()
            .email('Die Rechnungs-E-Mail-Adresse scheint ungültig zu sein.')
            .max(200, 'Die E-Mail-Adresse darf nicht länger als 200 Zeichen sein.')
            .optional()
    ),
    vatId: z.string().max(50, 'Die USt-IdNr. darf nicht länger als 50 Zeichen sein.').optional(),
})

export const CreateCheckoutSchema = z
    .object({
        conferenceId: z.string().uuid('Ungültige Konferenz-ID.'),
        purchaseType: z.enum(['personal', 'company'], {
            error: 'Bitte wähle zwischen Privat oder Firma.',
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
    conferenceId: z.string().uuid('Ungültige Konferenz-ID.'),
})

// Ticket portal (attendee profile completion)

export const TicketProfileSchema = z.object({
    job_title: z
        .string()
        .min(1, 'Bitte trage deinen Job/Rolle ein.')
        .max(100, 'Der Job/Rolle darf nicht länger als 100 Zeichen sein.'),
    company: z
        .string()
        .min(1, 'Bitte trage dein Unternehmen ein.')
        .max(100, 'Das Unternehmen darf nicht länger als 100 Zeichen sein.'),
    dietary_preferences: z.string().max(200, 'Maximal 200 Zeichen.').optional().or(z.literal('')),
    pronouns: z.string().max(50, 'Maximal 50 Zeichen.').optional().or(z.literal('')),
    tshirt_size: z.enum(['S', 'M', 'L', 'XL', 'XXL', '']).optional(),
    last_event_visited: z.string().max(200, 'Maximal 200 Zeichen.').optional().or(z.literal('')),
    heard_about_from: z.string().max(500, 'Maximal 500 Zeichen.').optional().or(z.literal('')),
    additional_notes: z.string().max(1000, 'Maximal 1000 Zeichen.').optional().or(z.literal('')),
})

// Check-in

export const CheckinScanSchema = z.object({
    ticketCode: z.string().min(1),
})

// Newsletter signup

export const NewsletterSignupSchema = z.object({
    email: z
        .string()
        .trim()
        .email('Deine E-Mail-Adresse scheint ungültig zu sein.')
        .max(200, 'Deine E-Mail-Adresse darf nicht länger als 200 Zeichen lang sein.'),
})

export type CreateCheckoutInput = z.infer<typeof CreateCheckoutSchema>
export type TicketAttendeeInput = z.infer<typeof TicketAttendeeSchema>
export type TicketProfileInput = z.infer<typeof TicketProfileSchema>
