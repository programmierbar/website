import { Dependencies } from '../buzzsprout/handlers/types.js';
import { createHookErrorConstructor } from './../shared/errors.ts';
import { postSlackMessage } from './../shared/postSlackMessage.ts';

async function generateTranscriptItem(
    HOOK_NAME: string,
    {
        metadata,
        context,
    }: {
        payload: any
        metadata: Record<string, any>
        context: any
    }, {
        logger,
        ItemsService,
    }: Dependencies,
) {
    try {
        logger.info(`${HOOK_NAME} hook: Start "${metadata.collection}" action function`)

        const podcastItemsService = new ItemsService(metadata.collection, {
            accountability: context.accountability,
            schema: context.schema,
        })

        const transcriptItemsService = new ItemsService('transcripts', {
            accountability: context.accountability,
            schema: context.schema,
        })

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

export default generateTranscriptItem;
