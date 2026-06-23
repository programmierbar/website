import { defineHook } from '@directus/extensions-sdk'
import { isPublishable } from '../shared/isPublishable.ts'
import { postSlackMessage } from '../shared/postSlackMessage.ts'
import { safeAction } from '../shared/safeHook.ts'
import type { CascadeRelation } from './util/cascadePublish.ts'
import { buildRelationFields, extractDraftIds, extractParentKeys, isPublishPayload } from './util/cascadePublish.ts'

const HOOK_NAME = 'cascade-publish'

const PODCAST_RELATIONS: CascadeRelation[] = [
    {
        relationField: 'speakers',
        childField: 'speaker',
        targetCollection: 'speakers',
    },
    {
        relationField: 'picks_of_the_day',
        targetCollection: 'picks_of_the_day',
    },
]

const MEETUP_RELATIONS: CascadeRelation[] = [
    {
        relationField: 'speakers',
        childField: 'speaker',
        targetCollection: 'speakers',
    },
    {
        relationField: 'talks',
        childField: 'talk',
        targetCollection: 'talks',
    },
]

interface SkippedItem {
    collection: string
    id: string | number
}

export default defineHook(({ action }, hookContext) => {
    const logger = hookContext.logger
    const ItemsService = hookContext.services.ItemsService
    const FieldsService = hookContext.services.FieldsService
    const getSchema = hookContext.getSchema
    const env = hookContext.env

    // safeAction wraps each callback so a thrown error / rejected promise can never
    // escape the action and crash the CMS. The callbacks RETURN the handler promise
    // so safeAction's `.catch` can observe failures that happen before (or outside)
    // the per-relation try/catch below.
    action(
        'podcasts.items.create',
        safeAction(HOOK_NAME, logger, (metadata, eventContext) =>
            handlePublishAction('podcasts', metadata, PODCAST_RELATIONS, eventContext)
        )
    )

    action(
        'podcasts.items.update',
        safeAction(HOOK_NAME, logger, (metadata, eventContext) =>
            handlePublishAction('podcasts', metadata, PODCAST_RELATIONS, eventContext)
        )
    )

    action(
        'meetups.items.create',
        safeAction(HOOK_NAME, logger, (metadata, eventContext) =>
            handlePublishAction('meetups', metadata, MEETUP_RELATIONS, eventContext)
        )
    )

    action(
        'meetups.items.update',
        safeAction(HOOK_NAME, logger, (metadata, eventContext) =>
            handlePublishAction('meetups', metadata, MEETUP_RELATIONS, eventContext)
        )
    )

    async function handlePublishAction(
        parentCollection: string,
        metadata: Record<string, any>,
        relations: CascadeRelation[],
        eventContext: Record<string, any>
    ) {
        if (!isPublishPayload(metadata.payload)) {
            return
        }

        const parentKeys = extractParentKeys(metadata)
        if (parentKeys.length === 0) {
            logger.warn(`${HOOK_NAME}: No key found for ${parentCollection} action`)
            return
        }

        const schema = await getSchema()

        for (const parentKey of parentKeys) {
            logger.info(`${HOOK_NAME}: ${parentCollection} ${parentKey} published, cascading to related items`)

            // Build the fields list for reading the parent with all its relations
            const fields = buildRelationFields(relations)

            // Read the parent item with nested relation data
            const parentService = new ItemsService(parentCollection, {
                schema,
                accountability: eventContext.accountability,
            })
            const parentItem = await parentService.readOne(parentKey, { fields })

            const errors: Error[] = []
            const skipped: SkippedItem[] = []

            for (const relation of relations) {
                try {
                    const relationSkipped = await cascadePublishRelation(schema, parentItem, relation, eventContext)
                    skipped.push(...relationSkipped)
                } catch (error: any) {
                    logger.error(
                        `${HOOK_NAME}: Failed to cascade ${relation.targetCollection} for ${parentCollection} ${parentKey}: ${error.message}`
                    )
                    errors.push(error)
                }
            }

            if (errors.length > 0) {
                await notifySlack(
                    `:warning: *${HOOK_NAME}*: Fehler beim automatischen Veröffentlichen von verknüpften Einträgen für ${parentCollection} ${parentKey}.\n` +
                        `Fehler: ${errors.map((e) => e.message).join(', ')}\n` +
                        `${env.PUBLIC_URL}admin/content/${parentCollection}/${parentKey}`
                )
            }

            if (skipped.length > 0) {
                await notifySlack(
                    `:warning: *${HOOK_NAME}*: Folgende mit ${parentCollection} ${parentKey} verknüpfte Einträge konnten nicht automatisch veröffentlicht werden, da Pflichtfelder fehlen. Bitte manuell prüfen und veröffentlichen:\n` +
                        skipped.map((item) => `${env.PUBLIC_URL}admin/content/${item.collection}/${item.id}`).join('\n')
                )
            }
        }
    }

    async function cascadePublishRelation(
        schema: any,
        parentItem: any,
        relation: CascadeRelation,
        eventContext: Record<string, any>
    ): Promise<SkippedItem[]> {
        const draftIds = extractDraftIds(parentItem, relation)

        if (draftIds.length === 0) {
            logger.info(`${HOOK_NAME}: No draft ${relation.targetCollection} items to publish`)
            return []
        }

        const targetService = new ItemsService(relation.targetCollection, {
            schema,
            accountability: eventContext.accountability,
        })

        // Read the full draft items so we can verify they meet the publish
        // requirements before forcing their status to "published".
        const draftItems = await targetService.readByQuery({
            filter: { id: { _in: draftIds } },
        })

        // Load the collection's field definitions to run the same publishability
        // guard that "schedule-publication" uses.
        const fieldsService = new FieldsService({ schema })
        const fields = await fieldsService.readAll(relation.targetCollection)

        const publishableIds: Array<string | number> = []
        const skipped: SkippedItem[] = []

        for (const item of draftItems) {
            if (isPublishable(item, fields)) {
                publishableIds.push(item.id)
            } else {
                skipped.push({ collection: relation.targetCollection, id: item.id })
            }
        }

        if (publishableIds.length > 0) {
            await targetService.updateMany(publishableIds, { status: 'published' })
            logger.info(
                `${HOOK_NAME}: Published ${publishableIds.length} ${relation.targetCollection} item(s): ${publishableIds.join(', ')}`
            )
        }

        if (skipped.length > 0) {
            logger.warn(
                `${HOOK_NAME}: Skipped ${skipped.length} incomplete ${relation.targetCollection} item(s) (missing required fields): ${skipped
                    .map((item) => item.id)
                    .join(', ')}`
            )
        }

        return skipped
    }

    async function notifySlack(message: string) {
        try {
            await postSlackMessage(message)
        } catch (slackError: any) {
            logger.error(`${HOOK_NAME}: Failed to send Slack notification: ${slackError.message}`)
        }
    }

    logger.info(`${HOOK_NAME} hook registered`)
})
