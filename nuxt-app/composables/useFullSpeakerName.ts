import { computed } from '@vue/composition-api';
import { StrapiSpeaker } from 'shared-code';
import { getFullSpeakerName } from '../helpers';

/**
 * Composable that creates the full name for a speaker.
 *
 * @param strapiImage A Strapi speaker object.
 *
 * @returns The full name of the speaker.
 */
export function useFullSpeakerName(speaker: StrapiSpeaker | null | undefined) {
  return computed(() => getFullSpeakerName(speaker));
}
