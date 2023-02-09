import { reactive, ref, Ref, watch } from 'vue';

// Global is loading state
const isLoading = ref(false);

/**
 * Composable to set and get the global state of the loading screen.
 *
 * @param dataList A list of fetched data.
 *
 * @returns The state of the loading screen.
 */
export function useLoadingScreen(...dataList: Ref<unknown>[]) {
  // Set initial state
  isLoading.value = dataList.some((data) => !data.value);

  // Change state on update
  watch(dataList, () => {
    isLoading.value = dataList.some((data) => !data.value);
  });

  // Return state of loading screen
  return reactive({ isLoading });
}
