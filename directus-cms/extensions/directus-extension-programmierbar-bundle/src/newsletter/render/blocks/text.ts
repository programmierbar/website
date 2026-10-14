import { sanitizeRichText } from '../escape.ts'
import type { NewsletterTextBlock } from '../types.ts'
import { headingMjml } from './heading.ts'

/** Text block: optional heading plus the sanitized rich-text body. */
export function textBlockMjml(block: NewsletterTextBlock): string {
    return `
    <mj-section css-class="block block-text">
      <mj-column>
        ${headingMjml(block.heading)}
        <mj-text>${sanitizeRichText(block.body)}</mj-text>
      </mj-column>
    </mj-section>`
}
