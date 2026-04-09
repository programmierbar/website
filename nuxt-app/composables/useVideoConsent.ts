import { ref, onMounted } from 'vue'
import { getCookie, setCookie } from '../helpers'

const COOKIE_NAME = 'youtube_consent'

const hasConsented = ref(false)

export function useVideoConsent() {
  onMounted(() => {
    hasConsented.value = getCookie(COOKIE_NAME) === 'true'
  })

  const grantConsent = (remember: boolean) => {
    hasConsented.value = true
    if (remember) {
      setCookie(COOKIE_NAME, 'true', 365)
    }
  }

  return { hasConsented, grantConsent }
}
