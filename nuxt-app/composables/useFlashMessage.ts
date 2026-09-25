export interface FlashMessage {
    type: 'rating' | 'rating-error'
    text: string
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

    const setMessage = (text: string, type: 'rating') => {
        message.value = {
            text,
            type,
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
