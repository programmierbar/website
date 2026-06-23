import { AbstractItemHandler } from './ItemHandler.ts';

export class TranscriptHandler extends AbstractItemHandler {

    private MAX_TEXT_LENGTH = 2500;

    get collectionName(): string {
        return 'transcripts';
    }

    // Transcripts are the one collection that MUST be paged through. Each row embeds a full hour of
    // audio transcription in `raw_response` (multi-MB JSON), so reading all ~170 at once with
    // `limit: -1` overruns Directus' response and pins hundreds of MB in memory. A small page keeps
    // each bulk read — and the rebuild's memory footprint — manageable.
    get pageSize(): number {
        return 10;
    }

    // Every field read by updateRequired(), buildAttributes() and buildDistinctKey(). `status` is
    // added by the hook. The deep `podcast.*` read is CRITICAL: the related podcast supplies the
    // entry's title/number/date/cover/slug AND its id for the distinct key. Without it the hook
    // builds metadata-less entries and crashes on `item.podcast.id`.
    get indexFields(): string[] {
        return ['id', 'podcast.*', 'speakers.*', 'service', 'supported_features', 'raw_response'];
    }

    updateRequired(item: any): boolean {
        return (
            item.podcast ||
            item.speakers ||
            item.service ||
            item.supported_features ||
            item.raw_response
        )
    }

    requiresDistinctDeletionBeforeUpdate(): boolean {
        return true;
    }

    buildDistinctKey(item: any): string {
        // Depends on `podcast` being loaded (see indexFields). The hook and CLIs always read
        // `podcast.*`, so this is safe; it would throw for a transcript with no podcast linked, which
        // is not a valid state for an indexable transcript.
        return `podcast-${item.podcast.id}`;
    }

    buildAttributes(item: any): Record<string, any>[] {
        const podcast = item.podcast;
        let podcastAttributes = {};
        if (podcast) {
            podcastAttributes = {
                title: podcast.title,
                number: podcast.number,
                type: podcast.type,
                published_on: podcast.published_on,
                image: podcast.cover_image ? `${this.env.PUBLIC_URL}assets/${podcast.cover_image}` : undefined,
                slug: podcast.slug,
            }
        }

        let transcriptText = "";
        if (item.service === "deepgram") {
                if (item.raw_response?.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
                    transcriptText = item.raw_response?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
                }
        }
        const transcriptChunks = this.splitTranscriptText(transcriptText);

        return transcriptChunks.map(chunk => {
            return {
                _type : 'transcript',
                transcript: chunk,
                ...podcastAttributes,
            }
        })
    }

    private splitTranscriptText(transcriptText: string): string[] {
        const chunks: string[] = [];

        let currentIndex = 0;

        while (currentIndex < transcriptText.length) {
            // Find the next possible chunk within the remaining text
            let endIndex = Math.min(currentIndex + this.MAX_TEXT_LENGTH, transcriptText.length);
            const substring = transcriptText.substring(currentIndex, endIndex);

            if (substring.length < this.MAX_TEXT_LENGTH) {
                // If the substring fits entirely, add it as the last chunk
                chunks.push(substring.trim());
                break;
            }

            // Find the last sentence-ending punctuation within the substring
            let lastSentenceEnd = substring.lastIndexOf(".", this.MAX_TEXT_LENGTH - 1);
            lastSentenceEnd = Math.max(lastSentenceEnd, substring.lastIndexOf("?", this.MAX_TEXT_LENGTH - 1));
            lastSentenceEnd = Math.max(lastSentenceEnd, substring.lastIndexOf("!", this.MAX_TEXT_LENGTH - 1));

            if (lastSentenceEnd === -1) {
                // If no sentence-ending punctuation is found, break at MAX_TEXT_LENGTH
                chunks.push(substring.trim());
                currentIndex += this.MAX_TEXT_LENGTH;
            } else {
                // Split at the sentence-ending punctuation
                chunks.push(substring.substring(0, lastSentenceEnd + 1).trim());
                currentIndex += lastSentenceEnd + 1; // Move past the punctuation
            }
        }

        return chunks;
    }
}
