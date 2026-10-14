/**
 * Pure client-side helpers for the newsletter actions interface: they turn the
 * `POST /newsletter-send/:id/test` response into what the admin sees. Kept free of
 * Vue and Directus imports so they can be unit-tested.
 */

export interface HiddenEntryDto {
    collection: 'podcasts' | 'meetups'
    title: string
    status: string | null
}

export interface TestSendResponse {
    recipient: string
    subject: string
    unsubscribe: 'subscriber' | 'test'
    hidden: HiddenEntryDto[]
    warnings: string[]
}

export interface TestSendResultView {
    message: string
    /** Shown as a warning list below the success message; empty when everything was sent as-is. */
    notes: string[]
}

const COLLECTION_LABELS = { podcasts: 'Podcast', meetups: 'Meetup' } as const

export function describeTestSendResult(response: TestSendResponse): TestSendResultView {
    const unsubscribe =
        response.unsubscribe === 'subscriber'
            ? 'Der Abmeldelink ist dein echter – Klicken meldet dich vom Newsletter ab.'
            : 'Der Abmeldelink ist ein Test-Link ohne Wirkung.'

    const notes = [
        ...response.hidden.map(
            (entry) =>
                `Ausgeblendet, weil nicht veröffentlicht: ${COLLECTION_LABELS[entry.collection] ?? entry.collection} „${entry.title || '(ohne Titel)'}“ (${entry.status ?? 'ohne Status'})`
        ),
        ...response.warnings,
    ]

    return {
        message: `Testversand „${response.subject}“ an ${response.recipient} verschickt. ${unsubscribe}`,
        notes,
    }
}

/** The text of the confirm dialog; names the recipient so nobody is surprised. */
export function confirmText(recipient: string | null): string {
    const to = recipient ? `an deine Adresse ${recipient}` : 'an die E-Mail-Adresse deines Benutzerkontos'
    return (
        `Die gespeicherte Fassung dieser Ausgabe wird ${to} geschickt, mit „[TEST]“ vor dem Betreff. ` +
        'Ungespeicherte Änderungen und Content Versions sind nicht enthalten. Es wird nichts an Abonnenten verschickt.'
    )
}
