import { defineHook } from '@directus/extensions-sdk'
import { createHookErrorConstructor } from '../shared/errors.ts'

const HOOK_NAME = 'create-profile'

export default defineHook(({ filter }, hookContext) => {
    const logger = hookContext.logger
    const ItemsService = hookContext.services.ItemsService

    filter('users.create', (payload, metadata, context) => handleFilter( { payload, metadata, context }))

    async function handleFilter(
    {
        payload,
        metadata,
        context,
    }: {
        payload: any
        metadata: Record<string, any>
        context: any
    }) {
        try {
            logger.info(`${HOOK_NAME} hook: Start filter function`)

            if (payload.profile) {
                logger.info(`${HOOK_NAME} hook: User already has profile. Exiting early.`)
                return payload
            }

            // Note that we manually set the knex/database connection here.
            // As this called from a filter, we are within an ongoing database transaction, and the database is locked
            // Meaning we need to manually use the existing connection, as a new one would not be available.
            const profilesItemsService = new ItemsService('profiles', {
                accountability: context.accountability,
                schema: context.schema,
                knex: context.database,
            })

            const newProfileId = await profilesItemsService.createOne({});

            logger.info(`${HOOK_NAME} hook: Created profile ${newProfileId} for newly created user.`)

            return {
                ...payload,
                // the following structure is necessary for directus to make the m2m connection
                profiles: [
                    {
                        profiles_id: newProfileId,
                    },
                ]
            }

            // Handle unknown errors
        } catch (error: any) {
            logger.error(`${HOOK_NAME} hook: Error: ${error.message}`)
            const hookError = createHookErrorConstructor(HOOK_NAME, error.message)
            throw new hookError()
        }

        return payload
    }
})
