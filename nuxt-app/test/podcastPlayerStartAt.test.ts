import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRenderer, defineComponent, h } from 'vue'
import type { usePodcastPlayer } from '../composables/usePodcastPlayer'

type UsePodcastPlayer = typeof usePodcastPlayer
type PodcastPlayer = ReturnType<UsePodcastPlayer>
type PodcastArg = Parameters<PodcastPlayer['setPodcast']>[0]

// The composable tracks Fathom goals on play/pause; stub the helper barrel so
// importing it doesn't pull in Nuxt-only modules.
vi.mock('../helpers', () => ({ trackGoal: vi.fn() }))

/**
 * Minimal stand-in for the global HTMLAudioElement the player creates. Mirrors
 * the parts of the media element the composable touches, including the browser
 * behaviour that matters here: assigning `src` resets `readyState`/`currentTime`,
 * so a seek only sticks once metadata has arrived.
 */
class FakeAudio extends EventTarget {
    currentTime = 0
    duration = NaN
    volume = 1
    readyState = 0
    paused = true
    #src = ''

    get src() {
        return this.#src
    }

    set src(value: string) {
        this.#src = value
        this.readyState = 0
        this.currentTime = 0
        this.duration = NaN
    }

    play() {
        this.paused = false
        this.dispatchEvent(new Event('play'))
        return Promise.resolve()
    }

    pause() {
        this.paused = true
        this.dispatchEvent(new Event('pause'))
    }

    /** Simulate the browser finishing the metadata fetch for the current src. */
    loadMetadata(duration = 3600) {
        this.readyState = 1
        this.duration = duration
        this.dispatchEvent(new Event('loadedmetadata'))
    }
}

/**
 * The composable creates its audio element in `onMounted`, so it needs a real
 * component instance. Mount one through a no-op renderer: that gives us the
 * mounted lifecycle without needing a DOM, keeping these tests in the suite's
 * plain-node environment.
 */
function mountWithPlayer(usePlayer: UsePodcastPlayer) {
    let player!: PodcastPlayer
    const noop = () => {}
    const { createApp } = createRenderer({
        createElement: () => ({}) as never,
        createText: () => ({}) as never,
        setElementText: noop,
        insert: noop,
        remove: noop,
        patchProp: noop,
        parentNode: () => null,
        nextSibling: () => null,
        setText: noop,
    })
    createApp(
        defineComponent({
            setup() {
                player = usePlayer()
                return () => h('div')
            },
        })
    ).mount({} as never)
    return player
}

const EPISODE = {
    id: 1,
    slug: 'deep-dive-142',
    type: 'deep_dive',
    number: '142',
    title: 'Test-Episode',
    audio_url: 'https://example.com/142.mp3',
} as PodcastArg

const OTHER_EPISODE = { ...EPISODE, id: 2, audio_url: 'https://example.com/143.mp3' }

let audio: FakeAudio
let player: PodcastPlayer

beforeEach(async () => {
    audio = new FakeAudio()
    vi.stubGlobal('document', { createElement: () => audio })
    // The composable holds module-level state (one player per app), so reset the
    // module registry between tests to get a fresh player each time.
    vi.resetModules()
    const { usePodcastPlayer } = await import('../composables/usePodcastPlayer')
    player = mountWithPlayer(usePodcastPlayer)
})

describe('usePodcastPlayer startAt', () => {
    it('seeks to the offset once metadata arrives (news reference play button)', () => {
        player.setPodcast(EPISODE, { startAt: 600 })
        player.play()

        // Nothing to seek yet — the browser has not loaded metadata.
        expect(audio.currentTime).toBe(0)

        audio.loadMetadata()

        expect(audio.currentTime).toBe(600)
        expect(player.currentTime).toBe(600)
    })

    it('applies the offset when the already-loaded episode is re-loaded with one', () => {
        player.setPodcast(EPISODE)
        audio.loadMetadata()

        player.setPodcast(EPISODE, { startAt: 90 })
        // `setPodcast` always re-assigns src, which resets readyState — so even
        // for the same episode the seek waits for metadata again.
        audio.loadMetadata()

        expect(audio.currentTime).toBe(90)
    })

    it('does not seek when no offset is given', () => {
        player.setPodcast(EPISODE)
        audio.loadMetadata()

        expect(audio.currentTime).toBe(0)
    })

    it('drops a pending seek when another episode is loaded before metadata', () => {
        player.setPodcast(EPISODE, { startAt: 600 })
        player.setPodcast(OTHER_EPISODE)

        audio.loadMetadata()

        // The first episode's offset must not leak into the newly loaded one.
        expect(audio.currentTime).toBe(0)
        expect(player.podcast?.id).toBe(OTHER_EPISODE.id)
    })
})
