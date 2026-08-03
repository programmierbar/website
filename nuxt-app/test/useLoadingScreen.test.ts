import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ref, type Ref } from 'vue'

// `useLoadingScreen` reads Nuxt's `useState`, which is an auto-import at runtime. Stand in a minimal
// version with the two properties that matter: it returns a Vue `ref` (so `reactive()` unwraps it
// exactly as in production), and there is one store per "request", so a value created during a
// request is reused within it and gone in the next.
let store: Map<string, Ref<unknown>>
const newRequest = () => {
    store = new Map()
}

beforeEach(() => {
    newRequest()
    ;(globalThis as Record<string, unknown>).useState = <T>(key: string, init: () => T) => {
        if (!store.has(key)) {
            store.set(key, ref(init()) as Ref<unknown>)
        }
        return store.get(key) as Ref<T>
    }
})

afterEach(() => {
    delete (globalThis as Record<string, unknown>).useState
})

describe('useLoadingScreen', () => {
    it('does not carry state from one request into the next', async () => {
        // `isLoading` used to be a module-scope `ref`, created once per server worker and shared by
        // every concurrent request, so one visitor's pending navigation could show another visitor a
        // loading screen — and make the server's HTML disagree with that visitor's first client render.
        const { useLoadingScreen } = await import('../composables/useLoadingScreen')

        const pending = ref<unknown>(null)
        expect(useLoadingScreen(pending).isLoading).toBe(true)

        newRequest()
        const loaded = ref<unknown>({ data: 'ready' })
        expect(useLoadingScreen(loaded).isLoading).toBe(false)
    })

    it('shares one flag between all callers within a request', async () => {
        // The page sets the flag by passing its data; `LoadingScreen.vue` calls with no arguments.
        // Both must observe the same state or the loading screen cannot work at all.
        //
        // Note the quirk this pins down: a no-argument call *writes* `false`, because
        // `[].some(...)` is false. It reads like a getter and is not one. The order in `app.vue`
        // (LoadingScreen before `<nuxt-page />`) is what stops that clobbering the page's value.
        const { useLoadingScreen } = await import('../composables/useLoadingScreen')

        const pending = ref<unknown>(null)
        const fromPage = useLoadingScreen(pending)
        expect(fromPage.isLoading).toBe(true)

        useLoadingScreen()

        expect(fromPage.isLoading).toBe(false)
    })

    it('tracks its data list within a request', async () => {
        const { useLoadingScreen } = await import('../composables/useLoadingScreen')

        const data = ref<unknown>(null)
        const state = useLoadingScreen(data)
        expect(state.isLoading).toBe(true)

        data.value = { data: 'ready' }
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(state.isLoading).toBe(false)
    })
})
