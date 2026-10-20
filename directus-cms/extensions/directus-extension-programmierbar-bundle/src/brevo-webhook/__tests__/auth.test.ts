import { describe, expect, test } from '@jest/globals'
import { checkBasicAuth } from '../auth.ts'

const SECRET = 'a3f1c9d2e8b74f60a3f1c9d2e8b74f60'
const basic = (user: string, password: string) => `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`

describe('checkBasicAuth', () => {
    test('accepts the secret as password, whatever the user name', () => {
        expect(checkBasicAuth(basic('brevo', SECRET), SECRET)).toEqual({ ok: true })
        expect(checkBasicAuth(basic('', SECRET), SECRET)).toEqual({ ok: true })
        expect(checkBasicAuth(basic('brevo', SECRET).replace('Basic', 'basic'), SECRET)).toEqual({ ok: true })
    })

    test('a password containing a colon is compared as a whole', () => {
        expect(checkBasicAuth(basic('brevo', 'a:b'), 'a:b')).toEqual({ ok: true })
    })

    test('rejects wrong, missing or non-Basic credentials with 401', () => {
        for (const header of [
            basic('brevo', 'wrong'),
            basic('brevo', `${SECRET}x`),
            basic(SECRET, ''),
            undefined,
            '',
            `Bearer ${SECRET}`,
            `Basic ${Buffer.from(SECRET).toString('base64')}`, // no colon: no password at all
        ]) {
            expect(checkBasicAuth(header, SECRET)).toMatchObject({ ok: false, status: 401 })
        }
    })

    test('fails closed with 503 when no secret is configured', () => {
        for (const secret of [undefined, null, '', '   ']) {
            expect(checkBasicAuth(basic('brevo', ''), secret)).toMatchObject({ ok: false, status: 503 })
            expect(checkBasicAuth(basic('brevo', 'anything'), secret)).toMatchObject({ ok: false, status: 503 })
        }
    })
})
