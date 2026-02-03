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
