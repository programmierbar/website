import { describe, expect, it } from 'vitest'
import { anonymizeAndHashIP } from '../server/utils/ipProcessing'

// Stored ratings carry these hashes, and the vote cooldown matches on them. Any change to the
// anonymization or hashing splits the cooldown across a deploy, so these values must not move.
describe('anonymizeAndHashIP', () => {
    it.each([
        ['203.0.113.7', '2172243fafcf160d8b3bf50e372877cfd3700fe0f59db1c795e26b2201cdb65f'],
        ['198.51.100.1', 'a1f1df59d2c345dbc1f874828f8e38d51d4f204b292a49476339d0cbe2c1cb8f'],
        ['2001:db8:85a3::8a2e:370:7334', 'dab6247d103932741ae6fd88d67d510316f0e0334b117cf2c47cd95ab2b8514a'],
        ['2001:db8::1', '45095fc532f8e21e39470bf8f3e0e4f7cfbcb77d47cdde8b75a8daa7aa0e7c6b'],
        ['::1', '3078dd4fcbe4e59f28e7bb376037df6186a78cb47515f95812dcde2fd46116ef'],
    ])('hashes %s to its stored value', (ip, hash) => {
        expect(anonymizeAndHashIP(ip)).toBe(hash)
    })

    it('drops the last two IPv4 octets before hashing', () => {
        expect(anonymizeAndHashIP('203.0.113.250')).toBe(anonymizeAndHashIP('203.0.113.7'))
    })

    it('treats the compressed and the full IPv6 form alike', () => {
        expect(anonymizeAndHashIP('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(
            anonymizeAndHashIP('2001:db8:85a3::8a2e:370:7334')
        )
    })

    it('ignores surrounding whitespace', () => {
        expect(anonymizeAndHashIP(' 203.0.113.7 ')).toBe(anonymizeAndHashIP('203.0.113.7'))
    })

    it.each(['not-an-ip', '', '999.1.1.1'])('returns undefined for %j', (ip) => {
        expect(anonymizeAndHashIP(ip)).toBeUndefined()
    })
})
