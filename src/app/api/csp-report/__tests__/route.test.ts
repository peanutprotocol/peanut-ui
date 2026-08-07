import type { NextRequest } from 'next/server'
import { POST } from '../route'

jest.mock('next/server', () => ({
    NextResponse: class MockNextResponse {
        status: number

        constructor(_body: unknown, init: { status: number }) {
            this.status = init.status
        }
    },
}))

const mockedFetch = jest.fn()

describe('CSP report collector payment explorer privacy', () => {
    beforeAll(() => {
        Object.defineProperty(global, 'fetch', { configurable: true, writable: true, value: mockedFetch })
    })

    beforeEach(() => {
        mockedFetch.mockReset()
        process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://public@example.ingest.sentry.io/123'
    })

    it.each([
        {
            contentType: 'application/csp-report',
            payload: {
                'csp-report': {
                    'document-uri':
                        'https://peanut.me/dev/payment-graph?user=marker-user&password=marker-password&focus=marker-focus',
                    'blocked-uri': 'https://blocked.example/script.js',
                    'effective-directive': 'script-src',
                },
            },
        },
        {
            contentType: 'application/reports+json',
            payload: [
                {
                    type: 'csp-violation',
                    body: {
                        documentURL: 'https://peanut.me/dev/payment-graph?focus=marker-focus',
                        blockedURL: 'https://blocked.example/script.js',
                        effectiveDirective: 'script-src',
                    },
                },
            ],
        },
    ])('returns 204 without forwarding $contentType explorer reports', async ({ contentType, payload }) => {
        const request = {
            headers: new Headers({ 'content-type': contentType }),
            json: jest.fn().mockResolvedValue(payload),
        } as unknown as NextRequest

        const response = await POST(request)

        expect(response.status).toBe(204)
        expect(mockedFetch).not.toHaveBeenCalled()
    })
})
