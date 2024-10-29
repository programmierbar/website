const transcription = require('../../../utils/transcription')

const HOOK_NAME = 'triggerTranscription'

module.exports = ({ env, exceptions: { BaseException }, logger, services: { ItemsService } }) =>
    async function triggerTranscription({ payload, metadata, context }) {
        try {
            // Log start info
            logger.info(`${HOOK_NAME} hook: Start "${metadata.collection}" action function`)

            // Create podcast items service instance
            const podcastItemsService = new ItemsService('podcasts', {
                accountability: context.accountability,
                schema: context.schema,
            })

            // Get podcast item from podcast items service by key
            const podcastItem = await podcastItemsService.readOne(metadata.key || metadata.keys[0])

            let { audio_url } = payload
            let { transcription_id, audio_url: existingAudioUrl } = podcastItem

            if (transcription_id && !audio_url) {
                logger.info(`${HOOK_NAME} hook: Transcription exists. Do nothing.`)
                return
            }

            if (!transcription_id && !(existingAudioUrl || audio_url)) {
                logger.info(`${HOOK_NAME} hook: No audio file. Do nothing.`)
                return
            }

            const publishedOn = new Date(podcastItem.published_on)

            // If podcast item was published before 2022-11-01, do not trigger transcript
            if (publishedOn < new Date('2022-11-01')) {
                logger.info(`${HOOK_NAME} hook: Do not need to trigger transcript`)
                return
            }
            audio_url ??= existingAudioUrl
            logger.info(`${HOOK_NAME} hook: Audio File ${audio_url}`)

            transcription_id = await transcription.create(podcastItem.title, audio_url, env, logger)

            // If update data contains something, update podcast item
            logger.info(`${HOOK_NAME} hook: Transcription ID=${transcription_id}`)

            if (!transcription_id) {
                logger.error(`${HOOK_NAME} hook: No Transcription was created. Abort.`)
                return
            }
            await podcastItemsService.updateOne(metadata.key || metadata.keys[0], {
                transcription_id,
                transcription_export_id: null,
                transcription_done: false,
            })
            logger.info(`${HOOK_NAME} hook: Transcript triggered.`)
        } catch (error) {
            logger.error(`${HOOK_NAME} hook: Error: ${error.message}`)
            throw new BaseException(error.message, 500, 'UNKNOWN')
        }
    }
