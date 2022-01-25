interface Speaker {
  academic_title?: string | null;
  first_name: string;
  last_name: string;
}

/**
 * A helper function that returns the full name of a speaker.
 *
 * @param podcast A speaker object.
 *
 * @returns The full name of the speaker.
 */
export function getFullSpeakerName(speaker: Speaker) {
  return (
    (speaker.academic_title || '') +
    ' ' +
    speaker.first_name +
    ' ' +
    speaker.last_name
  ).trim();
}
