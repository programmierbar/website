import { defineHook } from '@directus/extensions-sdk'
import { ISSUES_COLLECTION } from '../newsletter/loadIssue.ts'
import { checkIssueWrite, type IssueState } from '../newsletter/send/issueRules.ts'
import { createHookErrorConstructor } from '../shared/errors.ts'

const HOOK_NAME = 'newsletter-scheduling'

/**
 * Guards writes to `newsletter_issues` (rules in `newsletter/send/issueRules.ts`):
 *
 * - scheduling (status `scheduled`, on create AND on update) needs a subject, a
 *   `scheduled_at` and at least one block;
 * - `sending`/`sent` and `html_snapshot` are set only by the send job;
 * - subject, preheader, blocks and `scheduled_at` are frozen once the send started.
 *
 * The send job writes without accountability and is not restricted. A violation throws
 * a 400 with a readable message, so the Data Studio shows it on save.
 */
export default defineHook(({ filter }, hookContext) => {
    const { services, logger } = hookContext

    // A read error is thrown, not turned into "no stored issue": that would skip the
    // sending/sent freeze and let the write through (fail closed).
    async function readState(key: string | number, schema: unknown): Promise<IssueState> {
        const issues = new services.ItemsService(ISSUES_COLLECTION, { schema, accountability: null })
        const issue = await issues.readOne(key, { fields: ['status', 'subject', 'scheduled_at', 'blocks'] })
        return {
            status: issue?.status ?? null,
            subject: issue?.subject ?? null,
            scheduled_at: issue?.scheduled_at ?? null,
            blockCount: Array.isArray(issue?.blocks) ? issue.blocks.length : 0,
        }
    }

    function reject(message: string): never {
        logger.info(`${HOOK_NAME}: rejected write: ${message}`)
        const HookError = createHookErrorConstructor('NEWSLETTER_ISSUE_INVALID', message, 400)
        throw new HookError()
    }

    filter(`${ISSUES_COLLECTION}.items.create`, (payload: any, _meta: any, context: any) => {
        const message = checkIssueWrite(payload ?? {}, null, !context?.accountability)
        if (message) reject(message)
        return payload
    })

    filter(`${ISSUES_COLLECTION}.items.update`, async (payload: any, meta: any, context: any) => {
        const isSystem = !context?.accountability
        if (isSystem) return payload

        const keys: Array<string | number> = Array.isArray(meta?.keys) ? meta.keys : []
        for (const key of keys) {
            const existing = await readState(key, context?.schema ?? (await hookContext.getSchema()))
            const message = checkIssueWrite(payload ?? {}, existing, false)
            if (message) reject(message)
        }
        return payload
    })
})
