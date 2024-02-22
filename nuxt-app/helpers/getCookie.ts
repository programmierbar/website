/**
 * Helper function to get the value of a browser cookie.
 *
 * @param name The name of the cookie.
 *
 * @returns The value of the cookie.
 */
export function getCookie(name: string) {
    return document.cookie
        .split('; ')
        .find((cookie) => name === cookie.split('=')[0])
        ?.split('=')[1]
}
