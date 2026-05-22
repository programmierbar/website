export interface SourceCallbacks {
    onTimeUpdate(time: number): void
    onDurationChange(duration: number): void
    onPlay(): void
    onPause(): void
    onEnded(): void
}

export interface MediaSource {
    play(): void
    pause(): void
    seek(time: number): void
    setVolume(volume: number): void
    destroy(): void
}

export function createAudioElementSource(audio: HTMLAudioElement, callbacks: SourceCallbacks): MediaSource {
    const handlers: Record<string, () => void> = {
        timeupdate: () => callbacks.onTimeUpdate(audio.currentTime),
        loadedmetadata: () => callbacks.onDurationChange(audio.duration),
        durationchange: () => callbacks.onDurationChange(audio.duration),
        play: () => callbacks.onPlay(),
        pause: () => callbacks.onPause(),
        ended: () => callbacks.onEnded(),
    }
    for (const [event, handler] of Object.entries(handlers)) {
        audio.addEventListener(event, handler)
    }

    return {
        play: () => {
            void audio.play()
        },
        pause: () => audio.pause(),
        seek: (time: number) => {
            audio.currentTime = time
        },
        setVolume: (volume: number) => {
            audio.volume = volume
        },
        destroy: () => {
            for (const [event, handler] of Object.entries(handlers)) {
                audio.removeEventListener(event, handler)
            }
        },
    }
}

export function createYouTubePlayerSource(player: YT.Player, callbacks: SourceCallbacks): MediaSource {
    let pollHandle: ReturnType<typeof setInterval> | null = null

    const startPolling = () => {
        if (pollHandle !== null) return
        pollHandle = setInterval(() => {
            try {
                callbacks.onTimeUpdate(player.getCurrentTime())
            } catch {
                // Player may have been torn down between ticks; ignore.
            }
        }, 250)
    }

    const stopPolling = () => {
        if (pollHandle !== null) {
            clearInterval(pollHandle)
            pollHandle = null
        }
    }

    const onStateChange = (event: YT.PlayerEvent) => {
        switch (event.data) {
            case YT.PlayerState.PLAYING:
                try {
                    callbacks.onDurationChange(player.getDuration())
                } catch {
                    /* ignore */
                }
                callbacks.onPlay()
                startPolling()
                break
            case YT.PlayerState.PAUSED:
                try {
                    callbacks.onTimeUpdate(player.getCurrentTime())
                } catch {
                    /* ignore */
                }
                callbacks.onPause()
                stopPolling()
                break
            case YT.PlayerState.ENDED:
                callbacks.onEnded()
                stopPolling()
                break
            default:
                break
        }
    }

    player.addEventListener('onStateChange', onStateChange)

    return {
        play: () => player.playVideo(),
        pause: () => player.pauseVideo(),
        seek: (time: number) => player.seekTo(time, true),
        setVolume: (volume: number) => player.setVolume(Math.round(Math.max(0, Math.min(1, volume)) * 100)),
        destroy: () => {
            stopPolling()
            try {
                player.removeEventListener('onStateChange', onStateChange)
            } catch {
                // The player iframe may already be gone; tearing down listeners is best-effort.
            }
        },
    }
}
