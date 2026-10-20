import { escapeHtml } from '../newsletter/render/escape.ts'
import type { RenderReport } from '../newsletter/render/types.ts'

const COLLECTION_LABELS = { podcasts: 'Podcast', meetups: 'Meetup' } as const

/**
 * The editor-facing notice for the Live Preview: which podcasts/meetups the renderer
 * hid because they are not published, plus any other renderer warnings. Returns an
 * empty string when there is nothing to say.
 *
 * Preview-only by design — `renderNewsletterIssue` never adds it, so a sent mail can
 * never contain it.
 */
export function buildPreviewNotice(report: RenderReport): string {
    const { hidden, warnings } = report
    if (hidden.length === 0 && warnings.length === 0) {
        return ''
    }

    const parts: string[] = []
    if (hidden.length > 0) {
        const count = hidden.length === 1 ? '1 Eintrag' : `${hidden.length} Einträge`
        const items = hidden
            .map(
                (entry) =>
                    `<li>${COLLECTION_LABELS[entry.collection]}: ${escapeHtml(entry.title || '(ohne Titel)')} (${escapeHtml(entry.status ?? 'ohne Status')})</li>`
            )
            .join('')
        parts.push(
            `<p style="margin:0 0 4px">${count} ausgeblendet, weil nicht veröffentlicht:</p><ul style="margin:0 0 8px;padding-left:20px">${items}</ul>`
        )
    }
    if (warnings.length > 0) {
        const items = warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')
        parts.push(
            `<p style="margin:0 0 4px">Weitere Hinweise:</p><ul style="margin:0;padding-left:20px">${items}</ul>`
        )
    }

    return (
        '<div data-preview-notice role="note" style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.4;background:#fff4d6;color:#3d2e00;border-bottom:2px solid #e0b100;padding:12px 16px">' +
        '<p style="margin:0 0 8px;font-weight:bold">Hinweis der Vorschau – nicht Teil der Mail</p>' +
        parts.join('') +
        '</div>'
    )
}

/** Insert the notice right after the opening `<body>` tag (or in front, if there is none). */
export function injectPreviewNotice(html: string, notice: string): string {
    if (!notice) {
        return html
    }
    const body = /<body\b[^>]*>/i.exec(html)
    if (!body) {
        return notice + html
    }
    const end = body.index + body[0].length
    return html.slice(0, end) + notice + html.slice(end)
}
