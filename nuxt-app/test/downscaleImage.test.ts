import { describe, expect, it } from 'vitest'
import { getScaledDimensions } from '../helpers/downscaleImage'

describe('getScaledDimensions', () => {
    it('fits the longer edge into maxEdge, keeping the aspect ratio', () => {
        expect(getScaledDimensions(4032, 3024, 2400, 800)).toEqual({ width: 2400, height: 1800 })
        expect(getScaledDimensions(3024, 4032, 2400, 800)).toEqual({ width: 1800, height: 2400 })
    })

    it('never scales up', () => {
        expect(getScaledDimensions(1200, 900, 2400, 800)).toEqual({ width: 1200, height: 900 })
    })

    // The portal rejects images under 800px, so shrinking must not create one.
    it('keeps the shorter edge at or above minEdge for very elongated images', () => {
        expect(getScaledDimensions(6000, 1000, 2400, 800)).toEqual({ width: 4800, height: 800 })
    })
})
