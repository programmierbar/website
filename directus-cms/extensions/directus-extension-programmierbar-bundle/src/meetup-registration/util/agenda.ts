export interface AgendaItem {
    time: string
    label: string
}

/**
 * The usual evening, used when a meetup has no `agenda` of its own. Same
 * schedule as the "Agenda" paragraph in recent meetup descriptions.
 */
export const DEFAULT_MEETUP_AGENDA: AgendaItem[] = [
    { time: '18:00 Uhr', label: 'Begrüßung mit Catering und Getränken' },
    { time: '18:30 Uhr', label: 'Office-Tour (optional für alle Neugierigen)' },
    { time: '19:00 Uhr', label: 'Talk' },
    { time: 'Danach', label: 'Get-together, Drinks und Musik' },
]

/**
 * Parse `meetups.agenda`: one item per line, time and label separated by `|`,
 * e.g. `18:00 Uhr | Begrüßung`. A line without `|` becomes an item without a
 * time. Empty or missing text falls back to {@link DEFAULT_MEETUP_AGENDA}.
 */
export function parseAgenda(text: string | null | undefined): AgendaItem[] {
    const items = (text ?? '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const separator = line.indexOf('|')
            if (separator === -1) {
                return { time: '', label: line }
            }
            return { time: line.slice(0, separator).trim(), label: line.slice(separator + 1).trim() }
        })

    return items.length > 0 ? items : DEFAULT_MEETUP_AGENDA
}
