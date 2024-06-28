const transcription = require('../../../utils/transcription')

const HOOK_NAME = 'retrieveTranscription'

module.exports =
    ({ env, exceptions: { BaseException }, getSchema, logger, services: { ItemsService } }) =>
    async () => {
        try {
            // Log start info
            logger.info(`${HOOK_NAME} hook: Start schedule function`)

            const globalSchema = await getSchema()

            const podcastItemsService = new ItemsService('podcasts', {
                schema: globalSchema,
            })

            // Get any item whose "status" is "draft" and whose "published_on"
            // is less than or equal to the current timestamp
            const items = await podcastItemsService.readByQuery({
                filter: {
                    _and: [
                        {
                            transcription_id: {
                                _nnull: true,
                            },
                        },
                        {
                            transcription_done: {
                                _eq: false,
                            },
                        },
                    ],
                },
            })

            logger.info(`${HOOK_NAME} hook: Found ${items.length} items to check.`)

            await Promise.all(
                items.map(async (item) => {
                    logger.info(`${HOOK_NAME} hook: Checking Podcast "${item.title}".`)

                    const { transcription_id, transcription_export_id } = item

                    if (!transcription_export_id) {
                        const isTranscriptionDone = await transcription.isDone(transcription_id, env).catch((e) => {
                            logger.error(`${HOOK_NAME} hook: Error: ${e.message}`)
                            return null
                        })

                        if (!isTranscriptionDone) {
                            logger.info(`${HOOK_NAME} hook: Transcript for "${item.title}" is not ready yet.`)
                            return
                        }

                        const exportId = await transcription.createExport(transcription_id, env)

                        await podcastItemsService.updateOne(item.id, {
                            transcription_export_id: exportId,
                        })
                        logger.info(`${HOOK_NAME} hook: Transcript Export for "${item.title}" is triggered.`)
                    } else {
                        const transcript = await transcription.getExportUrl(transcription_export_id, env).catch((e) => {
                            logger.error(`${HOOK_NAME} hook: Error: ${e.message}`)
                            return null
                        })

                        if (!transcript) {
                            logger.info(`${HOOK_NAME} hook: Transcript Export for "${item.title}" is not ready yet.`)
                            return
                        }

                        await podcastItemsService.updateOne(item.id, {
                            transcript,
                            transcription_done: true,
                        })
                        logger.info(`${HOOK_NAME} hook: Transcript for "${item.title}" is created.`)
                    }
                })
            )

            // Handle unknown errors
        } catch (error) {
            logger.error(`${HOOK_NAME} hook: Error: ${error}`)
            throw new BaseException(error.message, 500, 'UNKNOWN')
        }
    }
