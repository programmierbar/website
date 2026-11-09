import { reactive, ref, watch } from 'vue'
import { useNavigator } from './useNavigator'

const FEEDBACK_DURATION_MS = 1500

/**
 * Composable for secure use of the share API.
 *
 * @returns A reference to the share API.
 */
export function useClipboard() {
    const navigator = useNavigator()
    const isSupported = ref(false)
    const isRichTextSupported = ref(false)
    const copied = ref(false)
    const failed = ref(false)

    watch(navigator, () => {
        isSupported.value = !!navigator.value?.clipboard
        isRichTextSupported.value = !!navigator.value?.clipboard?.write && typeof ClipboardItem !== 'undefined'
    })

    const flash = (state: typeof copied) => {
        state.value = true
        setTimeout(() => {
            state.value = false
        }, FEEDBACK_DURATION_MS)
    }

    const copy = (data: string) => {
        navigator.value?.clipboard.writeText(data).then(() => flash(copied))
    }

    /**
     * Copies formatted text. Rich text editors paste the HTML, plain text fields fall back to `text`.
     */
    const copyRichText = (html: string, text: string) => {
        navigator.value?.clipboard
            .write([
                new ClipboardItem({
                    'text/html': new Blob([html], { type: 'text/html' }),
                    'text/plain': new Blob([text], { type: 'text/plain' }),
                }),
            ])
            .then(
                () => flash(copied),
                () => flash(failed)
            )
    }

    return reactive({
        isSupported,
        isRichTextSupported,
        copied,
        failed,
        copy,
        copyRichText,
    })
}
