import { describe, expect, test } from '@jest/globals'
import { assertPublicUrl, isDisallowedIp, type Resolver } from './../urlSafety.ts'

describe('isDisallowedIp', () => {
    test.each([
        '127.0.0.1',
        '10.1.2.3',
        '172.16.0.1',
        '172.31.255.255',
        '192.168.0.1',
        '169.254.169.254', // cloud metadata endpoint
        '100.64.0.1', // carrier-grade NAT
        '0.0.0.0',
        '224.0.0.1', // multicast
        '::1',
        'fe80::1', // link-local
        'fc00::1', // unique-local
        '::ffff:127.0.0.1', // IPv4-mapped loopback
    ])('flags %s as disallowed', (ip) => {
        expect(isDisallowedIp(ip)).toBe(true)
    })

    test.each(['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '2606:4700:4700::1111'])(
        'allows public address %s',
        (ip) => {
            expect(isDisallowedIp(ip)).toBe(false)
        }
    )

    test('treats an unparseable IPv4 literal as disallowed', () => {
        expect(isDisallowedIp('999.1.1.1')).toBe(true)
    })
})

describe('assertPublicUrl', () => {
    const publicResolver: Resolver = async () => [{ address: '93.184.216.34', family: 4 }]
    const privateResolver: Resolver = async () => [{ address: '10.0.0.5', family: 4 }]

    test('resolves for a public http(s) URL', async () => {
        await expect(assertPublicUrl('https://example.com/page', publicResolver)).resolves.toBeUndefined()
    })

    test('rejects non-http(s) schemes', async () => {
        await expect(assertPublicUrl('file:///etc/passwd', publicResolver)).rejects.toThrow(/non-http/)
        await expect(assertPublicUrl('ftp://example.com', publicResolver)).rejects.toThrow(/non-http/)
    })

    test('rejects localhost without resolving', async () => {
        await expect(assertPublicUrl('http://localhost:8055/admin', publicResolver)).rejects.toThrow(/internal host/)
    })

    test('rejects a public hostname that resolves to a private address', async () => {
        await expect(assertPublicUrl('http://sneaky.example.com', privateResolver)).rejects.toThrow(/non-public address/)
    })

    test('rejects an unparseable URL', async () => {
        await expect(assertPublicUrl('not a url', publicResolver)).rejects.toThrow(/Invalid URL/)
    })

    test('rejects when the host does not resolve', async () => {
        const emptyResolver: Resolver = async () => []
        await expect(assertPublicUrl('https://nope.example', emptyResolver)).rejects.toThrow(/Could not resolve/)
    })
})
