import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const entry = '/q/home-hero-en'
const endpoint = '/api/marketing-qr/open'
const validBody = () => ({
    event_id: randomUUID(),
    opened_at: new Date().toISOString(),
    qr_id: 'home-hero-en',
    utm_source: 'google',
    utm_medium: 'cpc',
    utm_campaign: 'accounts-launch',
    utm_content: 'creative-a',
    attribution_origin: 'current_url',
    attribution_adjustment: 'none',
})

test.describe('marketing QR HTTP contract', () => {
    test('GET is standalone and private; HEAD carries no opening document', async ({ request }) => {
        const response = await request.get(entry)
        expect(response.status()).toBe(200)
        expect(response.headers()['content-type']).toContain('text/html')
        expect(response.headers()['cache-control']).toContain('no-store')
        expect(response.headers()['x-robots-tag']).toContain('noindex')
        expect(response.headers()['referrer-policy']).toBe('no-referrer')
        expect(response.headers()['content-security-policy']).toContain("default-src 'none'")
        expect(response.headers()['content-security-policy']).toContain("script-src 'nonce-")
        expect(response.headers()['content-security-policy']).toContain("frame-ancestors 'none'")
        const html = await response.text()
        expect(html).not.toMatch(/<script[^>]+src=["'][^"']*\/_next\//)
        expect(html).not.toMatch(/posthog\.init|sessionRecording|rrweb/)
        expect(html).toContain('apps.apple.com')
        expect(html).toContain('play.google.com')

        const head = await request.head(entry)
        expect(head.status()).toBe(200)
        expect(await head.body()).toHaveLength(0)
    })

    test('unknown registration is 404 and cannot reflect a hostile registration', async ({ request }) => {
        const response = await request.get('/q/not-a-registered-qr')
        expect(response.status()).toBe(404)
        expect(await response.text()).not.toContain('not-a-registered-qr')
    })

    test('accepts valid anonymous POSTs and repeated delivery without authentication', async ({ request, baseURL }) => {
        const data = validBody()
        for (let attempt = 0; attempt < 2; attempt++) {
            const response = await request.post(endpoint, { headers: { Origin: baseURL! }, data })
            expect(response.status()).toBe(204)
            expect(await response.body()).toHaveLength(0)
            expect(response.headers()['cache-control']).toContain('no-store')
        }
        // This localhost preview cannot pass the outbound production gate.
        // Positive PostHog delivery and storage deduplication are separate checks.
    })

    test('requires the exact origin, including when an otherwise valid body is supplied', async ({ request }) => {
        for (const origin of [undefined, 'https://example.invalid', 'null', 'https://peanut.me.attacker.invalid']) {
            const response = await request.post(endpoint, {
                headers: origin ? { Origin: origin } : {},
                data: validBody(),
            })
            expect(response.status(), `Origin=${origin}`).toBe(403)
        }
    })

    test('rejects malformed JSON and bodies larger than 1 KiB', async ({ request, baseURL }) => {
        const headers = { Origin: baseURL!, 'Content-Type': 'application/json' }
        const malformed = await request.post(endpoint, { headers, data: '{"event_id":' })
        expect(malformed.status()).toBe(400)
        const oversized = await request.post(endpoint, {
            headers,
            data: JSON.stringify({ ...validBody(), padding: 'x'.repeat(1025) }),
        })
        expect(oversized.status()).toBe(413)
    })

    const invalidChanges: Array<[string, Record<string, unknown>]> = [
        ['invalid event UUID', { event_id: 'not-a-uuid' }],
        ['invalid timestamp', { opened_at: 'yesterday' }],
        ['expired timestamp', { opened_at: '2020-01-01T00:00:00.000Z' }],
        ['future timestamp', { opened_at: '2099-01-01T00:00:00.000Z' }],
        ['unknown registration', { qr_id: 'payment-send-link' }],
        ['caller-controlled identity', { distinct_id: 'existing-user' }],
        ['caller-controlled page', { page_id: '/send/someone' }],
        ['destination override', { destination: 'https://example.invalid' }],
        ['click ID', { gclid: 'never-send-this' }],
        ['email campaign', { utm_campaign: 'someone@example.invalid' }],
        ['unknown medium', { utm_medium: 'qr-scan' }],
        ['unknown adjustment', { attribution_adjustment: 'made-up' }],
    ]
    for (const [name, change] of invalidChanges) {
        test(`rejects ${name}`, async ({ request, baseURL }) => {
            const response = await request.post(endpoint, {
                headers: { Origin: baseURL! },
                data: { ...validBody(), ...change },
            })
            expect(response.status()).toBe(400)
            const text = await response.text()
            for (const value of Object.values(change)) expect(text).not.toContain(String(value))
        })
    }

    test('unsupported endpoint methods do not capture', async ({ request }) => {
        for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) {
            const response = await request.fetch(endpoint, { method })
            expect(response.status(), method).toBe(405)
        }
    })
})
