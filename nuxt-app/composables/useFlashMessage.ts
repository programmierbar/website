export interface FlashMessage {
    type: 'rating' | 'rating-error'
    text: string
    payload: any
}

export const useFlashMessage = () => {
    const flashCookie = useCookie<FlashMessage | null>('flash-message')
    const message = useState<FlashMessage | null>('flash-message', () => {
        const cookieValue = flashCookie.value
        // Clear the cookie immediately after reading it so it only shows once
        if (cookieValue) {
            flashCookie.value = null
        }
        return cookieValue
    })

    // `Record<string, unknown>`, not `{}` — the latter accepts any non-nullish value, including `0`
    // and `""`, which is not what "payload" means here.
    const setMessage = (text: string, type: 'rating', payload: Record<string, unknown>) => {
        message.value = {
            text,
            type,
            payload,
        }
    }

    const clearMessage = () => {
        message.value = null
    }

    return {
        message,
        setMessage,
        clearMessage,
    }
}
