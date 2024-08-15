import type { DirectusTranscriptItem } from '~/types';
import { DirectusTranscriptItemServices } from '~/types';

interface WordTimestamp {
  word: string,
  time: number,
}

interface SequentialParagraph {
  speaker: string,
  wordlist: WordTimestamp[],
}

function getNameForSpeaker(speakerIdentifier: string, transcript: DirectusTranscriptItem) {
  let speakerName = '???';
  transcript.speakers?.forEach(speaker => {
    if (String(speaker.identifier) === String(speakerIdentifier)) {
      speakerName = speaker.name;
      return;
    }
  });
  return speakerName;
}

function prepareTranscriptFromDeepgram(transcript: DirectusTranscriptItem): SequentialParagraph[] {
  let sequentialParagraphs: SequentialParagraph[] = [];
  let currentSpeaker = '';
  let consolidatedText = '';
  let currentWordList: WordTimestamp[] = [];

  transcript.raw_response?.results.utterances.forEach(utterance => {
    utterance.words.forEach(word => {
      if (currentSpeaker === '' || currentSpeaker === word.speaker) {
        consolidatedText += ' ' + word.punctuated_word;
        currentWordList.push({ word: word.punctuated_word, time: word.start });
        currentSpeaker = word.speaker;
      } else {
        sequentialParagraphs.push({ speaker: currentSpeaker, wordlist: currentWordList });
        currentWordList = [];
        currentWordList.push({ word: word.punctuated_word, time: word.start });
        currentSpeaker = word.speaker;
      }
    });
  });

  sequentialParagraphs.push({ speaker: currentSpeaker, wordlist: currentWordList });

  sequentialParagraphs = sequentialParagraphs.map(paragraph => {
    paragraph.speaker = getNameForSpeaker(paragraph.speaker, transcript);

    return paragraph;
  });

  return sequentialParagraphs;
}

export function prepareTranscript(transcript: DirectusTranscriptItem): SequentialParagraph[] {
  switch (transcript.service) {
    case DirectusTranscriptItemServices.Deepgram:
      return prepareTranscriptFromDeepgram(transcript);
    default:
      throw new Error(`Unknown transcript service "${transcript.service}". Cannot prepare transcript.`);
  }
}
