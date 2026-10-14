/**
 * Sort rows by their Directus `sort` field (ascending). Rows without a sort value go last;
 * ties keep their incoming order. Returns a new array and never mutates the input.
 */
export function sortBySortField<T extends { sort?: number | null }>(rows: readonly T[]): T[] {
    return rows
        .map((row, index) => ({ row, index }))
        .sort((a, b) => {
            const sa = typeof a.row.sort === 'number' ? a.row.sort : Number.POSITIVE_INFINITY
            const sb = typeof b.row.sort === 'number' ? b.row.sort : Number.POSITIVE_INFINITY
            if (sa !== sb) {
                return sa < sb ? -1 : 1
            }
            return a.index - b.index
        })
        .map(({ row }) => row)
}
