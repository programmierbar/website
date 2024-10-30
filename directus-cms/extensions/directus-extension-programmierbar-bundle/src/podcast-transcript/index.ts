import { defineHook } from '@directus/extensions-sdk'

import generateTranscriptItem from './generateTranscriptItem.js';
import processTranscriptItem from './processTranscriptItem.js';

const HOOK_NAME = 'podcast-transcript-create'

export default defineHook(({ action, schedule }, hookContext) => {
    const logger = hookContext.logger
    const ItemsService = hookContext.services.ItemsService
    const getSchema = hookContext.getSchema
    const env = hookContext.env

    action('podcasts.items.create', ({ payload, ...metadata }, context) =>
        generateTranscriptItem(HOOK_NAME, { payload, metadata, context }, {logger, ItemsService})
    )

    action('podcasts.items.update', ({ payload, ...metadata }, context) =>
        generateTranscriptItem(HOOK_NAME, { payload, metadata, context }, {logger, ItemsService})
    )

    schedule('*/1 * * * *',
        processTranscriptItem(HOOK_NAME, {logger, ItemsService, getSchema, env})
    )
})
