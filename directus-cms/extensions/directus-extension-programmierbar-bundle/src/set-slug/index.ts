import { defineHook } from '@directus/extensions-sdk'
import { createHookErrorConstructor } from '../shared/errors.ts'
import { getPayloadWithSlug } from './util/getPayloadWithSlug.js';

const HOOK_NAME = 'set-slug'

export default defineHook(({ filter }, hookContext) => {
    const logger = hookContext.logger
    const ItemsService = hookContext.services.ItemsService
    /**
     * It sets the "slug" field on newly created items, if necessary.
     */
    filter('items.create', (payload, metadata, context) => handleFilter('create', { payload, metadata, context }))

    /**
     * It sets the "slug" field on updated items, if necessary.
     */
    filter('items.update', (payload, metadata, context) => handleFilter('update', { payload, metadata, context }))

    /**
     * It handles the filter logic that sets the "slug" field
     * on newly created or updated items, if necessary.
     *
     * @param type The filter typ.
     * @param data The filter data.
     *
     * @returns The new payload.
     */
    async function handleFilter(
        type: string,
        { payload, metadata, context }: { payload: any; metadata: Record<string, any>; context: any }
    ) {
        try {
            // Log start info
            logger.info(`${HOOK_NAME} hook: Start filter function`)

            // Get fields of collection
            const { fields } = context.schema.collections[metadata.collection]

            // Check if fields contain "slug"
            if (fields.slug) {
                // If item is newly created, return payload with "slug"
                if (type === 'create') {
                    return getPayloadWithSlug(payload, { metadata, payload })
                }

                // If item has been updated, fields contain "slug" and
                // payload contains a field that is included in "slug",
                // create future item and return payload with "slug"
                if (
                    type === 'update' &&
                    (
                        (metadata.collection === 'speakers' && (payload.academic_title || payload.first_name || payload.last_name)) ||
                        (metadata.collection === 'podcasts' && (payload.type || payload.number || payload.title)) ||
                        (metadata.collection === 'meetups' && payload.title) ||
                        (metadata.collection === 'conferences' && payload.title) ||
                        (metadata.collection === 'profiles' && (payload.first_name || payload.last_name))
                    )
                ) {
                    // Create items service instance
                    const itemsService = new ItemsService(metadata.collection, {
                        accountability: context.accountability,
                        schema: context.schema,
                    })

                    // Get item from item service by its key
                    const item = await itemsService.readOne(metadata.keys[0])

                    // Create future item by merging item with payload
                    const futureItem = { ...item, ...payload }

                    logger.info(
                        `${HOOK_NAME} hook: Set "slug" at ${
                            metadata.keys && metadata.keys[0]
                                ? `"${metadata.collection}" item with ID "${metadata.keys[0]}"`
                                : `newly created "${metadata.collection}" item`
                        }`
                    )

                    // Get the new payload with slug
                    const newPayload = await getPayloadWithSlug(futureItem, { metadata, payload })

                    // For podcasts: save old slug to history if the podcast is published and slug is changing
                    if (
                        metadata.collection === 'podcasts' &&
                        item.status === 'published' &&
                        item.slug &&
                        newPayload.slug &&
                        item.slug !== newPayload.slug
                    ) {
                        await saveSlugToHistory(item.id, item.slug, context)
                    }

                    // Return payload with "slug"
                    return newPayload
                }
            }

            // Handle unknown errors
        } catch (error: any) {
            logger.error(`${HOOK_NAME} hook: Error: ${error.message}`)
            const hookError = createHookErrorConstructor(HOOK_NAME, error.message)
            throw new hookError()
        }

        // Otherwise just return payload
        return payload
    }

    /**
     * Saves the old slug to the podcast_slug_history collection.
     * This allows old URLs to redirect to the new slug.
     *
     * @param podcastId The ID of the podcast
     * @param oldSlug The old slug being replaced
     * @param context The hook context
     */
    async function saveSlugToHistory(podcastId: string, oldSlug: string, context: { accountability: any; schema: any }) {
        try {
            const slugHistoryService = new ItemsService('podcast_slug_history', {
                accountability: context.accountability,
                schema: context.schema,
            })

            // Check if this slug already exists in history for this podcast
            const existingEntries = await slugHistoryService.readByQuery({
                filter: {
                    podcast: { _eq: podcastId },
                    old_slug: { _eq: oldSlug },
                },
                limit: 1,
            })

            // Only create a new entry if this slug isn't already in history
            if (!existingEntries || existingEntries.length === 0) {
                await slugHistoryService.createOne({
                    podcast: podcastId,
                    old_slug: oldSlug,
                })

                logger.info(`${HOOK_NAME} hook: Saved old slug "${oldSlug}" to history for podcast "${podcastId}"`)
            } else {
                logger.info(`${HOOK_NAME} hook: Slug "${oldSlug}" already exists in history for podcast "${podcastId}"`)
            }
        } catch (error: any) {
            // Log but don't fail the entire operation if slug history save fails
            logger.error(`${HOOK_NAME} hook: Failed to save slug to history: ${error.message}`)
        }
    }
})
