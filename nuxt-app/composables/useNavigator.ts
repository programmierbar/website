import { onMounted, ref } from 'vue'

/**
 * Composable for secure access of the navigator object.
 *
 * @returns A reference to the navigator object.
 */
export function useNavigator() {
    const _navigator = ref<Navigator>()

    onMounted(() => {
        _navigator.value = navigator
    })

    return _navigator
}
