import axios from 'axios'
import { postSlackMessage } from './../shared/postSlackMessage.ts'
import { Dependencies } from './../buzzsprout/handlers/types.js';

function processTranscriptItem(
    HOOK_NAME: string,
    {
        logger,
        ItemsService,
        getSchema,
        env
    }: Dependencies,
) {
    return async () => {
        logger.info(`${HOOK_NAME} hook: Start schedule function`)

        const globalSchema = await getSchema()

        const transcriptItemsService = new ItemsService('transcripts', {
            schema: globalSchema,
        })

        const existingTranscripts = await transcriptItemsService.readByQuery({filter: {raw_response: {'_null': true}}, sort: ['-date_created']});
        if (existingTranscripts.length == 0) {
            logger.info(`${HOOK_NAME} hook: Found no waiting transcripts. ` +
                `Exiting hook early.`);
            return;
        }
        const existingTranscript = existingTranscripts[0];

        logger.info(`${HOOK_NAME} hook: Processing transcript "${existingTranscript.id}".`);

        /*
         * Currently, we only support deepgram
         * In the future this will need to depend on `existingTranscript.service` (currently hard-coded to "deepgram")
         */

        const url = new URL(env.DEEPGRAM_API_URL);
        url.searchParams.append('model', 'nova-2');
        url.searchParams.append('smart_format', 'true');
        url.searchParams.append('diarize', 'true');
        url.searchParams.append('paragraphs', 'true');
        url.searchParams.append('utterances', 'true');
        url.searchParams.append('punctuate', 'true');
        url.searchParams.append('language', 'de');

        try {
            const response = await axios({
                method: 'POST',
                url: url.toString(),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${env.DEEPGRAM_API_KEY}`,
                },
                data: {
                    url: `${env.PUBLIC_URL}assets/${existingTranscript.podcast_audio_file}`,
                }
            })

            logger.info(`${HOOK_NAME} hook: Received transcription response.`);

            existingTranscript.raw_response = JSON.stringify(response.data);
            existingTranscript.supported_features = [
                "timestamps",
                "diarization"
            ];

            await transcriptItemsService.updateOne(existingTranscript.id, {
                raw_response: existingTranscript.raw_response,
                supported_features: existingTranscript.supported_features,
            });

            logger.info(`${HOOK_NAME} hook: Transcription persisted.`);
            try {
                await postSlackMessage(
                    `:info: *${HOOK_NAME} hook*: Transcript wurde erzeugt und kann veröffentlicht werden.`
                )
            } catch (slackError: any) {
                logger.error(`${HOOK_NAME} hook: Error: Could not post message to Slack: ${slackError.message}`)
            }

        } catch (error: any) {
            try {
                await postSlackMessage(
                    `:warning: *${HOOK_NAME} hook*: Transcript konnte nicht erzeugt werden. Error: ${error.message}`
                )
            } catch (slackError: any) {
                logger.error(`${HOOK_NAME} hook: Error: Could not post message to Slack: ${slackError.message}`)
            }
        }
    }
}

export default processTranscriptItem;
