import { describe, expect, it, vi } from 'vitest'
import { fitImagesIntoBudget, getScaledDimensions } from '../helpers/downscaleImage'

describe('getScaledDimensions', () => {
    it('fits the longer edge into maxEdge, keeping the aspect ratio', () => {
        expect(getScaledDimensions(4032, 3024, 2400, 1000)).toEqual({ width: 2400, height: 1800 })
        expect(getScaledDimensions(3024, 4032, 2400, 1000)).toEqual({ width: 1800, height: 2400 })
    })

    it('never scales up', () => {
        expect(getScaledDimensions(1200, 900, 2400, 1000)).toEqual({ width: 1200, height: 900 })
    })

    it('keeps the shorter edge at or above minEdge for very elongated images', () => {
        expect(getScaledDimensions(6000, 1500, 1600, 1000)).toEqual({ width: 4000, height: 1000 })
    })
})

const MB = 1024 * 1024
const fakeFile = (size: number, name = 'photo.jpg') => new File([new Uint8Array(size)], name)
// Stands in for the canvas re-encode, which needs a browser: returns a file of exactly maxBytes.
const shrinkToLimit = vi.fn(async (file: File, maxBytes: number) =>
    file.size <= maxBytes ? file : fakeFile(Math.floor(maxBytes), file.name)
)

describe('fitImagesIntoBudget', () => {
    it('leaves images alone that already fit together', async () => {
        const files = [fakeFile(2.9 * MB), fakeFile(1 * MB)]
        await expect(fitImagesIntoBudget(files, 4 * MB, shrinkToLimit)).resolves.toEqual(files)
    })

    // Two photos just under the per-image threshold would exceed Vercel's 4.5 MB limit together.
    it('shrinks two large images that only exceed the budget together', async () => {
        const result = await fitImagesIntoBudget([fakeFile(2.9 * MB), fakeFile(2.8 * MB)], 4 * MB, shrinkToLimit)
        expect(result).not.toBeNull()
        expect(result!.reduce((sum, file) => sum + file.size, 0)).toBeLessThanOrEqual(4 * MB)
    })

    it('shrinks only the larger image when that is enough', async () => {
        const small = fakeFile(1.5 * MB, 'small.jpg')
        const result = await fitImagesIntoBudget([fakeFile(2.9 * MB, 'large.jpg'), small], 4 * MB, shrinkToLimit)
        expect(result![0]!.size).toBe(Math.floor(2.5 * MB))
        expect(result![1]).toBe(small)
    })

    it('returns null if the images cannot be shrunk enough', async () => {
        const stubborn = async (file: File) => file
        await expect(
            fitImagesIntoBudget([fakeFile(2.9 * MB), fakeFile(2.9 * MB)], 4 * MB, stubborn)
        ).resolves.toBeNull()
    })
})
