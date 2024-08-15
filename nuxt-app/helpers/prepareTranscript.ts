import type { DirectusTranscriptItem } from '~/types'
import { DirectusTranscriptItemServices } from '~/types'

interface WordTimestamp {
    word: string
    time: number
}

interface SequentialParagraph {
    speaker: string
    wordlist: WordTimestamp[]
}

function getNameForSpeaker(speakerIdentifier: string, transcript: DirectusTranscriptItem) {
    const speaker = transcript.speakers?.find((speaker) => String(speaker.identifier) === String(speakerIdentifier))
    return speaker ? speaker.name : '???'
}

function transformProgrammierbar(word: string): string {
    const lowerWord = word.toLowerCase()
    if (lowerWord.includes('programmierbar')) {
        return word.replace(/programmierbar/i, 'programmier.bar')
    }
    return word
}

function prepareTranscriptFromDeepgram(transcript: DirectusTranscriptItem): SequentialParagraph[] {
    let sequentialParagraphs: SequentialParagraph[] = []
    let currentSpeaker = ''
    let currentWordList: WordTimestamp[] = []

    transcript.raw_response?.results.utterances.forEach((utterance) => {
        utterance.words.forEach((word) => {
            const transformedWord = transformProgrammierbar(word.punctuated_word)

            if (currentSpeaker === '' || currentSpeaker === word.speaker) {
                currentWordList.push({ word: transformedWord, time: word.start })
                currentSpeaker = word.speaker
            } else {
                sequentialParagraphs.push({ speaker: currentSpeaker, wordlist: currentWordList })
                currentWordList = []
                currentWordList.push({ word: transformedWord, time: word.start })
                currentSpeaker = word.speaker
            }
        })
    })

    sequentialParagraphs.push({ speaker: currentSpeaker, wordlist: currentWordList })

    sequentialParagraphs = sequentialParagraphs.map((paragraph) => {
        paragraph.speaker = getNameForSpeaker(paragraph.speaker, transcript)

        return paragraph
    })

    return sequentialParagraphs
}

export function prepareTranscript(transcript: DirectusTranscriptItem): SequentialParagraph[] {
    switch (transcript.service) {
        case DirectusTranscriptItemServices.Deepgram:
            return prepareTranscriptFromDeepgram(transcript)
        default:
            throw new Error(`Unknown transcript service "${transcript.service}". Cannot prepare transcript.`)
    }
}
