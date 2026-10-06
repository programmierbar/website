// The CMS keeps job title and company in a single `occupation` field ("CTO bei Beispiel GmbH"),
// while the speaker portal edits them as two fields. Our content is German, so " bei " is the
// separator we write; " at " is still understood because older profiles use it.
const SEPARATORS = [' bei ', ' at ']

export interface SpeakerOccupation {
    jobTitle: string
    company: string
}

/**
 * Splits an `occupation` string into job title and company.
 *
 * Splits at the *last* separator, so a job title that itself contains one ("Head of Data bei Nacht
 * bei Beispiel GmbH") keeps it. Without any separator the whole value is the job title.
 */
export function parseOccupation(occupation: string | null | undefined): SpeakerOccupation {
    const value = occupation?.trim() ?? ''

    for (const separator of SEPARATORS) {
        const index = value.lastIndexOf(separator)
        if (index !== -1) {
            return {
                jobTitle: value.slice(0, index).trim(),
                company: value.slice(index + separator.length).trim(),
            }
        }
    }

    return { jobTitle: value, company: '' }
}

/** Joins job title and company back into an `occupation` string, inverse of {@link parseOccupation}. */
export function formatOccupation({ jobTitle, company }: SpeakerOccupation): string {
    const title = jobTitle.trim()
    const employer = company.trim()

    if (!employer) {
        return title
    }
    if (!title) {
        return employer
    }

    return `${title} bei ${employer}`
}
