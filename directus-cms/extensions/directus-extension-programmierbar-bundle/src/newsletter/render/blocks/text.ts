import { sanitizeRichText } from '../escape.ts'
import type { NewsletterTextBlock, RenderReport } from '../types.ts'
import { headingMjml } from './heading.ts'

/** True when sanitized rich text shows any text (not just tags such as `<p><br></p>` or blanks). */
function hasVisibleText(html: string): boolean {
    return (
        html
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
            .trim() !== ''
    )
}

/**
 * Text block: optional heading plus the sanitized rich-text body. A block with neither a
 * heading nor visible body text renders nothing and is reported.
 */
export function textBlockMjml(block: NewsletterTextBlock, report: RenderReport): string {
    const body = sanitizeRichText(block.body)
    if (!block.heading?.trim() && !hasVisibleText(body)) {
        report.warnings.push('Text-Block übersprungen: kein Inhalt')
        return ''
    }
    return `
    <mj-section css-class="block block-text">
      <mj-column>
        ${headingMjml(block.heading)}
        <mj-text>${body}</mj-text>
      </mj-column>
    </mj-section>`
}
