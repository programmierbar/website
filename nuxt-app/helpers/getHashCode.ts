/**
 * Helper function to get a hash code from a string.
 *
 * @param source The source data of the hash code.
 *
 * @returns A hash code.
 */
export function getHashCode(source: string | undefined) {
    const string = JSON.stringify(source) ?? ''
    let hash = 0
    let char: number
    for (let i = 0; i < string.length; i += 1) {
        char = string.charCodeAt(i)
        hash = (hash << 5) - hash + char
        hash |= 0
    }
    return hash
}
