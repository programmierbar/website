import type { TalkItem } from '~/types';
import { getFullSpeakerName } from 'shared-code';

export const buildSpeakerNamesForTalk = function(talk: TalkItem): string {
  let result = 'mit ';

  const speakers: string[] = [];

  talk.speakers.forEach((speaker) => {
    speakers.push(getFullSpeakerName(speaker.speaker));
  });

  talk.members.forEach((member) => {
    speakers.push(`${member.member.first_name} ${member.member.last_name}`);
  });

  if (speakers.length === 0) {
    return '';
  }

  return result + speakers.join(' & ');
};
