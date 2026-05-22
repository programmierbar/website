const YOUTUBE_IFRAME_API_URL = 'https://www.youtube.com/iframe_api'
const SCRIPT_MARKER = 'data-youtube-iframe-api'

let apiPromise: Promise<typeof YT> | null = null

export function useYouTubeIframeApi(): Promise<typeof YT> {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('YouTube IFrame API is only available in the browser'))
    }

    if (apiPromise) {
        return apiPromise
    }

    if (window.YT?.Player) {
        apiPromise = Promise.resolve(window.YT)
        return apiPromise
    }

    apiPromise = new Promise<typeof YT>((resolve, reject) => {
        const previousCallback = window.onYouTubeIframeAPIReady
        window.onYouTubeIframeAPIReady = () => {
            if (typeof previousCallback === 'function') {
                previousCallback()
            }
            if (window.YT?.Player) {
                resolve(window.YT)
            } else {
                reject(new Error('YouTube IFrame API loaded without YT.Player'))
            }
        }

        const existing = document.querySelector<HTMLScriptElement>(`script[${SCRIPT_MARKER}]`)
        if (existing) return

        const script = document.createElement('script')
        script.src = YOUTUBE_IFRAME_API_URL
        script.async = true
        script.setAttribute(SCRIPT_MARKER, 'true')
        script.onerror = () => {
            apiPromise = null
            reject(new Error('Failed to load YouTube IFrame API'))
        }
        document.head.appendChild(script)
    })

    return apiPromise
}
