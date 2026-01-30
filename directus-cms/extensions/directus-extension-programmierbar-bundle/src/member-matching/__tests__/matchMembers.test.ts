import { describe, expect, test } from '@jest/globals'
import { extractSpeakerNames, findMatchingMembers, MemberData } from './../matchMembers.ts'

describe('extractSpeakerNames', () => {
    test('should extract names with timestamp format', () => {
        const transcript = `Jan Gregor Emge-Triebel (00:12.534)

Hallo und herzlich willkommen bei einer neuen News-Ausgabe.

Fabi Fink (00:35.735)
Ja, hast du`

        const result = extractSpeakerNames(transcript)
        expect(result).toContain('Jan Gregor Emge-Triebel')
        expect(result).toContain('Fabi Fink')
        expect(result).toHaveLength(2)
    })

    test('should extract simple speaker names with colon', () => {
        const transcript = `Dennis: Hello everyone, welcome to the show.
Jojo: Thanks Dennis, great to be here.
Fabi: Let's get started!`

        const result = extractSpeakerNames(transcript)
        expect(result).toEqual(['Dennis', 'Jojo', 'Fabi'])
    })

    test('should extract full names with first and last name (colon format)', () => {
        const transcript = `Dennis Becker: Welcome to the podcast.
Jojo Schweizer: Today we talk about TypeScript.`

        const result = extractSpeakerNames(transcript)
        expect(result).toEqual(['Dennis Becker', 'Jojo Schweizer'])
    })

    test('should handle markdown bold formatting', () => {
        const transcript = `**Dennis**: Hello everyone.
**Jojo**: Thanks for having me.`

        const result = extractSpeakerNames(transcript)
        expect(result).toEqual(['Dennis', 'Jojo'])
    })

    test('should handle German umlauts', () => {
        const transcript = `Jürgen: Guten Tag.
Björn: Hallo zusammen.`

        const result = extractSpeakerNames(transcript)
        expect(result).toEqual(['Jürgen', 'Björn'])
    })

    test('should deduplicate speaker names', () => {
        const transcript = `Dennis (00:01.000)
First point.

Jojo (00:05.000)
I agree.

Dennis (00:10.000)
Second point.`

        const result = extractSpeakerNames(transcript)
        expect(result).toContain('Dennis')
        expect(result).toContain('Jojo')
        expect(result).toHaveLength(2)
    })

    test('should return empty array for transcript without speaker labels', () => {
        const transcript = `This is just plain text without any speaker labels.
It continues on multiple lines.`

        const result = extractSpeakerNames(transcript)
        expect(result).toEqual([])
    })
})

describe('findMatchingMembers', () => {
    const members: MemberData[] = [
        { id: '1', first_name: 'Dennis', last_name: 'Becker' },
        { id: '2', first_name: 'Jojo', last_name: 'Schweizer' },
        { id: '3', first_name: 'Fabi', last_name: 'Eckner' },
        { id: '4', first_name: 'Sebi', last_name: 'Müller' },
        { id: '5', first_name: 'Jan-Gregor', last_name: 'Emge-Triebel' },
    ]

    test('should match by first name', () => {
        const speakerNames = ['Dennis', 'Jojo']
        const result = findMatchingMembers(speakerNames, members)

        expect(result).toHaveLength(2)
        expect(result[0].id).toBe('1')
        expect(result[1].id).toBe('2')
    })

    test('should match by full name', () => {
        const speakerNames = ['Dennis Becker', 'Fabi Eckner']
        const result = findMatchingMembers(speakerNames, members)

        expect(result).toHaveLength(2)
        expect(result[0].id).toBe('1')
        expect(result[1].id).toBe('3')
    })

    test('should handle case insensitivity', () => {
        const speakerNames = ['DENNIS', 'jojo']
        const result = findMatchingMembers(speakerNames, members)

        expect(result).toHaveLength(2)
        expect(result[0].id).toBe('1')
        expect(result[1].id).toBe('2')
    })

    test('should handle umlaut normalization', () => {
        const speakerNames = ['Sebi Muller'] // without umlaut
        const result = findMatchingMembers(speakerNames, members)

        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('4')
    })

    test('should not match unknown speakers', () => {
        const speakerNames = ['Unknown Person', 'Another Guest']
        const result = findMatchingMembers(speakerNames, members)

        expect(result).toHaveLength(0)
    })

    test('should not duplicate members', () => {
        const speakerNames = ['Dennis', 'Dennis Becker'] // Both would match Dennis
        const result = findMatchingMembers(speakerNames, members)

        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('1')
    })

    test('should preserve order from transcript', () => {
        const speakerNames = ['Fabi', 'Dennis', 'Jojo']
        const result = findMatchingMembers(speakerNames, members)

        expect(result).toHaveLength(3)
        expect(result[0].first_name).toBe('Fabi')
        expect(result[1].first_name).toBe('Dennis')
        expect(result[2].first_name).toBe('Jojo')
    })

    test('should match names with space vs hyphen differences', () => {
        // Transcript has "Jan Gregor" (space), DB has "Jan-Gregor" (hyphen)
        const speakerNames = ['Jan Gregor Emge-Triebel']
        const result = findMatchingMembers(speakerNames, members)

        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('5')
        expect(result[0].first_name).toBe('Jan-Gregor')
    })
})
