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
        .min(1, 'Bitte trage deine Nachricht ein.')
        .max(5000, 'Dein Nachricht darf nicht länger als 5.000 Zeichen lang sein.'),
})
