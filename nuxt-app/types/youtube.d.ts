declare global {
    interface Window {
        YT?: typeof YT
        onYouTubeIframeAPIReady?: () => void
    }

    namespace YT {
        class Player {
            constructor(target: HTMLElement | string, options: PlayerOptions)
            playVideo(): void
            pauseVideo(): void
            seekTo(seconds: number, allowSeekAhead: boolean): void
            getCurrentTime(): number
            getDuration(): number
            setVolume(volume: number): void
            getPlayerState(): number
            destroy(): void
            addEventListener(event: string, listener: ((event: PlayerEvent) => void) | string): void
            removeEventListener(event: string, listener: ((event: PlayerEvent) => void) | string): void
        }

        interface PlayerEvent {
            target: Player
            data: number
        }

        interface PlayerOptions {
            videoId?: string
            playerVars?: Record<string, string | number>
            events?: {
                onReady?: (event: PlayerEvent) => void
                onStateChange?: (event: PlayerEvent) => void
                onError?: (event: PlayerEvent) => void
            }
        }

        const PlayerState: {
            UNSTARTED: -1
            ENDED: 0
            PLAYING: 1
            PAUSED: 2
            BUFFERING: 3
            CUED: 5
        }
    }
}

export {}
