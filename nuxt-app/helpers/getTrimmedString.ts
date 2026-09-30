const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

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
    const cut = lastSpace > budget * 0.6 ? lastSpace : budget

    // Don't cut an emoji or other grapheme cluster (e.g. a ZWJ sequence or a flag) in half:
    // drop the cluster that straddles the cut instead
    let trimmedString = ''
    for (const { segment, index } of graphemeSegmenter.segment(string)) {
        if (index + segment.length > cut) break
        trimmedString += segment
    }

    return trimmedString.replace(/[\s.,;:!?–—-]+$/, '') + '…'
}
