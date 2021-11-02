import { StrapiSpeaker } from 'shared-code';

/**
 * A helper function that returns the full name for a speaker.
 *
 * @param podcast A speaker from our CMS.
 *
 * @returns The full name of the speaker.
 */
export function getFullSpeakerName(speaker: StrapiSpeaker | null | undefined) {
  return speaker
    ? (speaker.academic_title || '') +
        speaker.first_name +
        ' ' +
        speaker.last_name
    : '';
}
