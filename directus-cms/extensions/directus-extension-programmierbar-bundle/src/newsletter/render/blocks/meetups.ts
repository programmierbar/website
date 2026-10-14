import { escapeHtml, joinUrl } from '../escape.ts'
import { sortBySortField } from '../sort.ts'
import type { NewsletterMeetup, NewsletterMeetupsBlock } from '../types.ts'
import { headingMjml } from './heading.ts'

// Meetups take place in Germany; render their start in local time regardless of the server's zone.
const DATE_FORMAT = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    dateStyle: 'full',
    timeStyle: 'short',
})

function formatStart(startOn: string | null | undefined): string | null {
    if (!startOn) {
        return null
    }
    const date = new Date(startOn)
    return Number.isNaN(date.getTime()) ? null : `${DATE_FORMAT.format(date)} Uhr`
}

/** Meetups block: optional heading plus one linked entry (title + start) per selected meetup, in junction order. */
export function meetupsBlockMjml(block: NewsletterMeetupsBlock, websiteUrl: string): string {
    const meetups = sortBySortField(block.meetups ?? [])
        .map((row) => row.meetups_id)
        .filter((meetup): meetup is NewsletterMeetup => !!meetup && typeof meetup === 'object')

    const items = meetups.map((meetup) => {
        const title = escapeHtml(meetup.title)
        const link = meetup.slug
            ? `<a href="${escapeHtml(joinUrl(websiteUrl, `meetup/${encodeURIComponent(meetup.slug)}`))}">${title}</a>`
            : title
        const start = formatStart(meetup.start_on)
        return `<li>${link}${start ? `<br>${escapeHtml(start)}` : ''}</li>`
    })

    return `
    <mj-section css-class="block block-meetups">
      <mj-column>
        ${headingMjml(block.heading)}
        <mj-text><ul>${items.join('')}</ul></mj-text>
      </mj-column>
    </mj-section>`
}
