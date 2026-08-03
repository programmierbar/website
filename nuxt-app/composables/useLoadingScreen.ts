import type { Ref } from 'vue'
import { reactive, watch } from 'vue'

/**
 * Composable to set and get the global state of the loading screen.
 *
 * @param dataList A list of fetched data.
 *
 * @returns The state of the loading screen.
 */
export function useLoadingScreen(...dataList: Ref<unknown>[]) {
    // `useState`, not a module-scope `ref`: a module-scope ref is created once per server worker and
    // shared by every concurrent request, so one visitor's navigation can change what another
    // visitor's page renders. `useState` is per-request on the server.
    const isLoading = useState<boolean>('loading-screen', () => false)

    // Set initial state
    isLoading.value = dataList.some((data) => !data.value)

    // Change state on update
    watch(dataList, () => {
        isLoading.value = dataList.some((data) => !data.value)
    })

    // Return state of loading screen
    return reactive({ isLoading })
}
