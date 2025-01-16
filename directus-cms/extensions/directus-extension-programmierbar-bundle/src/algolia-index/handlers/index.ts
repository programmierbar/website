import { PodcastHandler } from "./PodcastHandler.ts"
import { ItemHandler } from "./ItemHandler.ts"
import { MeetupHandler } from './MeetupHandler.ts';
import { SpeakerHandler } from './SpeakerHandler.ts';
import { PickOfTheDayHandler } from './PickOfTheDayHandler.ts';

type knownHandlers = "podcastHandler" | "meetupHandler" | "speakerHandler" | "pickOfTheDayHandler";

export function getHandlers(env, logger): Record<knownHandlers, ItemHandler> {
    return {
        podcastHandler: new PodcastHandler(env, logger),
        meetupHandler: new MeetupHandler(env, logger),
        speakerHandler: new SpeakerHandler(env, logger),
        pickOfTheDayHandler: new PickOfTheDayHandler(env, logger),
    }
}
