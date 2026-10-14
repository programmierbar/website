import mjml2html from 'mjml'
import { meetupsBlockMjml } from './blocks/meetups.ts'
import { podcastsBlockMjml } from './blocks/podcasts.ts'
import { textBlockMjml } from './blocks/text.ts'
import { escapeHtml } from './escape.ts'
import { sortBySortField } from './sort.ts'
import {
    MEETUPS_BLOCK_COLLECTION,
    PODCASTS_BLOCK_COLLECTION,
    TEXT_BLOCK_COLLECTION,
    type NewsletterIssue,
    type NewsletterIssueBlock,
    type NewsletterMeetupsBlock,
    type NewsletterPodcastsBlock,
    type NewsletterTextBlock,
    type RenderOptions,
    type RenderResult,
} from './types.ts'

const UNSUBSCRIBE_PLACEHOLDER = '[Abmeldelink wird beim Versand eingesetzt]'

function blockMjml(block: NewsletterIssueBlock, options: RenderOptions, warnings: string[]): string {
    const item = block.item
    if (!item || typeof item !== 'object') {
        // The junction row points at a deleted block, or the relation was not expanded.
        warnings.push(`Block (${block.collection ?? 'unbekannt'}) ohne Inhalt übersprungen`)
        return ''
    }

    switch (block.collection) {
        case TEXT_BLOCK_COLLECTION:
            return textBlockMjml(item as NewsletterTextBlock)
        case PODCASTS_BLOCK_COLLECTION:
            return podcastsBlockMjml(item as NewsletterPodcastsBlock, options.websiteUrl)
        case MEETUPS_BLOCK_COLLECTION:
            return meetupsBlockMjml(item as NewsletterMeetupsBlock, options.websiteUrl)
        default:
            warnings.push(`Unbekannter Blocktyp '${block.collection}' übersprungen`)
            return ''
    }
}

function footerMjml(unsubscribeUrl: string | null | undefined): string {
    const unsubscribe = unsubscribeUrl
        ? `<a href="${escapeHtml(unsubscribeUrl)}">Newsletter abbestellen</a>`
        : escapeHtml(UNSUBSCRIBE_PLACEHOLDER)

    return `
    <mj-section css-class="issue-footer">
      <mj-column>
        <mj-divider />
        <mj-text>
          <p>Du bekommst diese Mail, weil du den Newsletter von programmier.bar abonniert hast.</p>
          <p>${unsubscribe}</p>
        </mj-text>
      </mj-column>
    </mj-section>`
}

/**
 * Build the MJML source of a newsletter issue: subject/preheader, then the blocks in
 * their `sort` order, then the footer with the unsubscribe link slot.
 *
 * Pure and synchronous — no I/O, no Directus — so the Live Preview and the send path
 * produce exactly the same markup from the same data.
 */
export function buildIssueMjml(issue: NewsletterIssue, options: RenderOptions, warnings: string[] = []): string {
    const subject = issue.subject?.trim() ?? ''
    const preheader = issue.preheader?.trim() ?? ''
    const blocks = sortBySortField(issue.blocks ?? [])
        .map((block) => blockMjml(block, options, warnings))
        .join('')

    return `<mjml lang="de">
  <mj-head>
    <mj-title>${escapeHtml(subject)}</mj-title>
    ${preheader ? `<mj-preview>${escapeHtml(preheader)}</mj-preview>` : ''}
    <mj-attributes>
      <mj-all font-family="Helvetica, Arial, sans-serif" />
    </mj-attributes>
  </mj-head>
  <mj-body>
    <mj-section css-class="issue-header">
      <mj-column>
        <mj-text><h1>${escapeHtml(subject)}</h1></mj-text>
      </mj-column>
    </mj-section>
    ${blocks}
    ${footerMjml(options.unsubscribeUrl)}
  </mj-body>
</mjml>`
}

/**
 * Render a newsletter issue to email-ready HTML. Data in, HTML out: used by the Live
 * Preview endpoint and meant to be reused unchanged by the send job.
 *
 * MJML validation problems and skipped blocks are returned as `warnings` instead of
 * thrown, so a half-finished draft still previews.
 */
export async function renderNewsletterIssue(issue: NewsletterIssue, options: RenderOptions): Promise<RenderResult> {
    const warnings: string[] = []
    const source = buildIssueMjml(issue, options, warnings)

    const { html, errors } = await mjml2html(source, {
        validationLevel: 'soft',
        keepComments: false,
        ignoreIncludes: true,
    })

    for (const error of errors ?? []) {
        warnings.push(`MJML: ${error.formattedMessage ?? error.message}`)
    }

    return { html, warnings }
}
