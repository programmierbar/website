import { PodcastHandler } from "./PodcastHandler.ts"
import ItemHandler from "./ItemHandler.ts"

export function getHandlers(env, logger): Record<string, ItemHandler> {
    return {
        podcastHandler: new PodcastHandler(env, logger)
    }
}
