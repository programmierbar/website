import { AbstractItemHandler } from './ItemHandler.ts';

export class TranscriptHandler extends AbstractItemHandler {

    private MAX_TEXT_LENGTH = 2500;

    get collectionName(): string {
        return 'transcripts';
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
        return `podcast-${item.podcast.id}`;
    }

    buildAttributes(item: any): Record<string, any>[] {
        const podcast = item.podcast;
        let podcastAttributes = {};
        if (!podcast) {
            podcastAttributes = {
                title: podcast.title,
                number: podcast.number,
                type: podcast.type,
                published_on: podcast.published_on,
                image: podcast.cover_image ? `${this._env.PUBLIC_URL}assets/${podcast.cover_image}` : undefined,
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
