interface RecaptchaResponse {
  success: boolean
  score: number
  action: string
  challenge_ts: string
  hostname: string
  'error-codes'?: string[]
}

/**
 * Verifies a reCAPTCHA token with Google's API
 * @param token - The reCAPTCHA token from the client
 * @returns The verification response from Google
 */
export async function verifyRecaptcha(token: string): Promise<RecaptchaResponse> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY

  if (!secretKey) {
    throw new Error('RECAPTCHA_SECRET_KEY is not configured')
  }

  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      secret: secretKey,
      response: token,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to verify reCAPTCHA token')
  }

  const data: RecaptchaResponse = await response.json()
  return data
}

/**
 * Validates a reCAPTCHA response against a score threshold
 * @param recaptchaResponse - The response from Google's verification API
 * @param threshold - Minimum acceptable score (0.0-1.0, default 0.5)
 * @returns true if validation passes
 */
export function validateRecaptchaScore(
  recaptchaResponse: RecaptchaResponse,
  threshold: number = 0.5
): boolean {
  if (!recaptchaResponse.success) {
    console.warn('reCAPTCHA verification failed:', recaptchaResponse['error-codes'])
    return false
  }

  if (recaptchaResponse.score < threshold) {
    console.warn(`reCAPTCHA score too low: ${recaptchaResponse.score} < ${threshold}`)
    return false
  }

  return true
}
