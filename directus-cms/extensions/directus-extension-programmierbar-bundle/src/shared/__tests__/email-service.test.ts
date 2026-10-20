import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { deliverTemplatedEmail, sendTemplatedEmail, type EmailServiceContext } from '../email-service.ts'

const send = jest.fn<(mail: any) => Promise<void>>()
let templates: Array<{ key: string; subject: string; body_html: string }> = []
let readError: Error | null = null

class FakeItemsService {
    async readByQuery(query: any) {
        if (readError) throw readError
        return templates
            .filter((t) => t.key === query.filter.key._eq)
            .map(({ subject, body_html }) => ({ subject, body_html }))
    }
}

class FakeMailService {
    send = send
}

function context(): EmailServiceContext {
    return {
        logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any,
        services: { ItemsService: FakeItemsService, MailService: FakeMailService },
        getSchema: async () => ({}),
    }
}

const OPTIONS = {
    templateKey: 'ticket_invoice_correction',
    to: 'buyer@example.test',
    cc: 'billing@example.test',
    data: { invoice_number: 'PB-CON26-002', purchaser_name: 'A <b>' },
    attachments: [{ filename: 'Rechnungsberichtigung-PB-CON26-002.pdf', content: Buffer.from('%PDF') }],
}

beforeEach(() => {
    send.mockReset()
    send.mockResolvedValue(undefined)
    readError = null
    templates = [
        {
            key: 'ticket_invoice_correction',
            subject: 'Rechnungsberichtigung {{invoice_number}}',
            body_html: '<p>Hallo {{purchaser_name}}</p>',
        },
    ]
})

describe('deliverTemplatedEmail', () => {
    test('renders the template and sends it with CC and attachments', async () => {
        await expect(deliverTemplatedEmail(OPTIONS, context())).resolves.toBe('sent')

        expect(send).toHaveBeenCalledTimes(1)
        const mail = send.mock.calls[0]![0]
        expect(mail).toMatchObject({
            to: 'buyer@example.test',
            cc: 'billing@example.test',
            subject: 'Rechnungsberichtigung PB-CON26-002',
            html: '<p>Hallo A &lt;b&gt;</p>',
        })
        expect(mail.attachments).toEqual([
            {
                filename: 'Rechnungsberichtigung-PB-CON26-002.pdf',
                content: Buffer.from('%PDF'),
                contentType: 'application/pdf',
            },
        ])
    })

    test('reports a missing template distinctly and sends nothing', async () => {
        templates = []
        const ctx = context()

        await expect(deliverTemplatedEmail(OPTIONS, ctx)).resolves.toBe('template_missing')
        expect(send).not.toHaveBeenCalled()
        expect(String((ctx.logger.error as jest.Mock).mock.calls[0]![0])).toContain('ticket_invoice_correction')
    })

    test('a failing template read is a failure, not a missing template', async () => {
        readError = new Error('db down')
        await expect(deliverTemplatedEmail(OPTIONS, context())).resolves.toBe('failed')
        expect(send).not.toHaveBeenCalled()
    })

    test('a failing transport is a failure', async () => {
        send.mockRejectedValue(new Error('provider down'))
        await expect(deliverTemplatedEmail(OPTIONS, context())).resolves.toBe('failed')
    })
})

describe('sendTemplatedEmail', () => {
    test('is true only when the mail was sent', async () => {
        await expect(sendTemplatedEmail(OPTIONS, context())).resolves.toBe(true)
        templates = []
        await expect(sendTemplatedEmail(OPTIONS, context())).resolves.toBe(false)
    })
})
