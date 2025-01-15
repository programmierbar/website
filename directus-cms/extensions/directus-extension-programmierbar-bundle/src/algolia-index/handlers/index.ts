import { PodcastHandler } from "./PodcastHandler.ts"
import { ItemHandler } from "./ItemHandler.ts"

type knownHandlers = "podcastHandler";

export function getHandlers(env, logger): Record<knownHandlers, ItemHandler> {
    return {
        podcastHandler: new PodcastHandler(env, logger)
    }
}
