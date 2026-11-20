import { describe, expect, it } from 'vitest'
import { getCheckinTshirt } from '../helpers/checkinTshirt'

const DEADLINE = '2026-09-30T23:59:59.999+02:00'

describe('getCheckinTshirt', () => {
    it('hands out the size for tickets ordered by the deadline', () => {
        expect(getCheckinTshirt('L', '2026-09-30T21:59:00.000Z', DEADLINE)).toEqual({ status: 'eligible', size: 'L' })
    })

    it('flags tickets ordered after the deadline, keeping the given size', () => {
        expect(getCheckinTshirt('M', '2026-09-30T22:00:00.000Z', DEADLINE)).toEqual({ status: 'too_late', size: 'M' })
        expect(getCheckinTshirt(null, '2026-10-15T10:00:00.000Z', DEADLINE)).toEqual({ status: 'too_late', size: null })
    })

    it('reports a missing size for tickets in time', () => {
        expect(getCheckinTshirt(null, '2026-05-01T10:00:00.000Z', DEADLINE)).toEqual({ status: 'no_size' })
        expect(getCheckinTshirt('', '2026-05-01T10:00:00.000Z', DEADLINE)).toEqual({ status: 'no_size' })
    })

    it('treats a ticket without a creation date as late', () => {
        expect(getCheckinTshirt('S', null, DEADLINE)).toEqual({ status: 'too_late', size: 'S' })
    })

    it('has no deadline when the conference has none', () => {
        expect(getCheckinTshirt('XL', '2027-10-01T10:00:00.000Z', undefined)).toEqual({
            status: 'eligible',
            size: 'XL',
        })
    })
})
