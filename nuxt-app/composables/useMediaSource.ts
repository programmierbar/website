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
    const reportDuration = () => {
        // load() resets duration to NaN and fires durationchange before the
        // real metadata arrives. Filter so transient resets don't shrink the
        // bar's max value (which would otherwise visually snap the scrubber).
        const duration = audio.duration
        if (Number.isFinite(duration) && duration > 0) {
            callbacks.onDurationChange(duration)
        }
    }
    const handlers: Record<string, () => void> = {
        timeupdate: () => {
            // load() resets currentTime to 0; some browsers fire timeupdate
            // during that reset. Ignore until the element has real data so we
            // don't clobber a freshly-applied seek with a stale 0.
            if (audio.readyState >= 1 /* HAVE_METADATA */) {
                callbacks.onTimeUpdate(audio.currentTime)
            }
        },
        loadedmetadata: reportDuration,
        durationchange: reportDuration,
        play: () => callbacks.onPlay(),
        pause: () => callbacks.onPause(),
        ended: () => callbacks.onEnded(),
    }
    for (const [event, handler] of Object.entries(handlers)) {
        audio.addEventListener(event, handler)
    }

    return {
        play: () => {
            audio.play().catch(() => {
                // Playback can be rejected (autoplay policy, src error, etc.);
                // reflect the real state in the bar instead of pretending we're
                // playing.
                callbacks.onPause()
            })
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
                break
            case YT.PlayerState.PAUSED:
                callbacks.onPause()
                break
            case YT.PlayerState.ENDED:
                callbacks.onEnded()
                break
            default:
                break
        }
    }

    player.addEventListener('onStateChange', onStateChange)

    // Poll continuously so that seeks inside the YouTube iframe (which may
    // happen while paused, and which have no dedicated IFrame API event) still
    // propagate to the bar UI.
    startPolling()

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
