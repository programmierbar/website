import { describe, expect, it } from 'vitest'
import { formatOccupation, parseOccupation } from '../helpers/speakerOccupation'

describe('parseOccupation', () => {
    it('splits at " bei "', () => {
        expect(parseOccupation('Senior Developer bei Beispiel GmbH')).toEqual({
            jobTitle: 'Senior Developer',
            company: 'Beispiel GmbH',
        })
    })

    it('falls back to " at " for older profiles', () => {
        expect(parseOccupation('CTO at Example Inc.')).toEqual({ jobTitle: 'CTO', company: 'Example Inc.' })
    })

    it('splits at the last occurrence', () => {
        expect(parseOccupation('Head of Data bei Nacht bei Beispiel GmbH')).toEqual({
            jobTitle: 'Head of Data bei Nacht',
            company: 'Beispiel GmbH',
        })
    })

    it('prefers " bei " over " at "', () => {
        expect(parseOccupation('Engineer at heart bei Beispiel GmbH')).toEqual({
            jobTitle: 'Engineer at heart',
            company: 'Beispiel GmbH',
        })
    })

    it('treats a value without separator as job title', () => {
        expect(parseOccupation('Freelancer')).toEqual({ jobTitle: 'Freelancer', company: '' })
    })

    it('handles empty values', () => {
        expect(parseOccupation(null)).toEqual({ jobTitle: '', company: '' })
        expect(parseOccupation(undefined)).toEqual({ jobTitle: '', company: '' })
        expect(parseOccupation('')).toEqual({ jobTitle: '', company: '' })
    })
})

describe('formatOccupation', () => {
    it('joins with " bei "', () => {
        expect(formatOccupation({ jobTitle: 'CTO', company: 'Beispiel GmbH' })).toBe('CTO bei Beispiel GmbH')
    })

    it('rewrites legacy " at " values to " bei "', () => {
        expect(formatOccupation(parseOccupation('CTO at Example Inc.'))).toBe('CTO bei Example Inc.')
    })

    it('omits the separator when the company is empty', () => {
        expect(formatOccupation({ jobTitle: 'Freelancer ', company: ' ' })).toBe('Freelancer')
    })

    it('round-trips', () => {
        const value = 'Head of Data bei Nacht bei Beispiel GmbH'
        expect(formatOccupation(parseOccupation(value))).toBe(value)
    })
})
