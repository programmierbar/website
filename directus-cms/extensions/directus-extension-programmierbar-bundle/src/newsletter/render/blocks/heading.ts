import { escapeHtml } from '../escape.ts'

/** Optional block heading; renders nothing when the editor left it empty. */
export function headingMjml(heading: string | null | undefined): string {
    if (!heading || !heading.trim()) {
        return ''
    }
    return `<mj-text><h2>${escapeHtml(heading)}</h2></mj-text>`
}
