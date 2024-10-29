import { defineHook } from '@directus/extensions-sdk'
import axios from 'axios'
import { createHookErrorConstructor } from '../shared/errors.ts'
import { postSlackMessage } from './../shared/postSlackMessage.ts'

const HOOK_NAME = 'podcast-transcript-create'

export default defineHook(({ action, schedule }, hookContext) => {
    const logger = hookContext.logger
    const ItemsService = hookContext.services.ItemsService
    const getSchema = hookContext.getSchema

    action('podcasts.items.create', ({ payload, ...metadata }, context) =>
        handleAction( { payload, metadata, context })
    )

    action('podcasts.items.update', ({ payload, ...metadata }, context) =>
        handleAction( { payload, metadata, context })
    )

    schedule('*/1 * * * *', handleSchedule)

    async function handleSchedule() {
        // Log start info
        logger.info(`${HOOK_NAME} hook: Start schedule function`)

        // Get database schema
        const globalSchema = await getSchema()

        const transcriptItemsService = new ItemsService('transcripts', {
            schema: globalSchema,
        })

        const existingTranscripts = await transcriptItemsService.readByQuery({filter: {status: 'draft'}, sort: ['-date_created']});
        if (existingTranscripts.length == 0) {
            logger.info(`${HOOK_NAME} hook: Found no waiting transcripts. ` +
                `Exiting hook early.`);
            return;
        }
        const existingTranscript = existingTranscripts[0];

        logger.info(`${HOOK_NAME} hook: Processing transcript "${existingTranscript.id}".`);

        return;

        /*
         * Currently, we only support deepgram
         * In the future this needs to depend on `existingTranscript.service` (currently hard-coded to "deepgram")
         */
        const response = await axios({
            method: 'POST',
            url: 'https://api.deepgram.com/v1/listen',
            params: {
                model: 'nova-2',
                smart_format: true,
                diarize: true,
                paragraphs: true,
                utterances: true,
                punctuate: true,
                language: 'de',
            }
        })

        logger.info(`${HOOK_NAME} hook: Received transcription response.`);

        console.log(response.data);
    }

    async function handleAction(
        {
            payload,
            metadata,
            context,
        }: {
            payload: any
            metadata: Record<string, any>
            context: any
        }
    ) {
        try {
            // Log start info
            logger.info(`${HOOK_NAME} hook: Start "${metadata.collection}" action function`)

            const podcastItemsService = new ItemsService(metadata.collection, {
                accountability: context.accountability,
                schema: context.schema,
            })

            const transcriptItemsService = new ItemsService('transcripts', {
                accountability: context.accountability,
                schema: context.schema,
            })

            // Get item from item service by key
            const item = await podcastItemsService.readOne(metadata.key || metadata.keys[0])

            if (!item.audio_file) {
                logger.info(
                    `${HOOK_NAME} hook: Updated podcast has no audio file set. ` +
                    `Exiting hook early.`
                );
                return;
            }

            const existingTranscripts = await transcriptItemsService.readByQuery({podcast_id: item.id, podcast_audio_file: item.audio_file});
            if (existingTranscripts.length > 0) {
                logger.info(`${HOOK_NAME} hook: Found ${existingTranscripts.length} existing transcripts for podcast: "${item.id}". ` +
                    `Exiting hook early.`);
                return;
            }

            const newTranscript = await transcriptItemsService.createOne({podcast: item.id, podcast_audio_file: item.audio_file, service: 'deepgram'});

            logger.info(
                `${HOOK_NAME} hook: Generated a transcript "${newTranscript.id}" for podcast: "${item.id}".`
            );
        } catch (error: any) {
            try {
                await postSlackMessage(
                    `:warning: *${HOOK_NAME} hook*: Transcript konnte nicht erzeugt werden. Error: ${error.message}`
                )
            } catch (slackError: any) {
                logger.error(`${HOOK_NAME} hook: Error: Could not post message to Slack: ${slackError.message}`)
            }

            logger.error(`${HOOK_NAME} hook: Error: ${error.message}`)
            const hookError = createHookErrorConstructor(HOOK_NAME, error.message)
            throw new hookError()
        }
    }
})
