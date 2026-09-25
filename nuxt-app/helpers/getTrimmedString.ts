/**
 * A helper function that trims a string to a maximal length. It cuts at the last word boundary if
 * there is one reasonably close to the limit, and marks the cut with an ellipsis.
 *
 * @param string The string to be trimmed.
 * @param maxLength The maximal length, including the ellipsis.
 *
 * @returns A trimmed string.
 */
export function getTrimmedString(string: string, maxLength: number) {
    if (string.length <= maxLength) {
        return string
    }
    if (maxLength < 1) {
        return ''
    }

    // Leave room for the ellipsis, but look one character further to
    // detect a word that ends exactly at the limit
    const budget = maxLength - 1
    const lastSpace = string.slice(0, budget + 1).lastIndexOf(' ')
    let trimmedString = lastSpace > budget * 0.6 ? string.slice(0, lastSpace) : string.slice(0, budget)

    // Don't cut an emoji or other character outside the BMP in half
    if (/[\uD800-\uDBFF]$/.test(trimmedString)) {
        trimmedString = trimmedString.slice(0, -1)
    }

    return trimmedString.replace(/[\s.,;:!?–—-]+$/, '') + '…'
}
