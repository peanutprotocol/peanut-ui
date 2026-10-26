import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

type CapturedEvent = {
    url: string
    method: string
    headers: Record<string, string>
    body: {
        api_key: string
        uuid: string
        timestamp: string
        event: string
        distinct_id: string
        properties: Record<string, unknown>
    }
    mode: string
}

const enabled = process.env.MARKETING_QR_RUNTIME_CAPTURE === 'true'
const sink = process.env.MARKETING_QR_CAPTURE_FILE
const canonicalHeaders = {
    Host: 'peanut.me',
    Origin: 'https://peanut.me',
    'X-Forwarded-Host': 'peanut.me',
    'X-Forwarded-Proto': 'https',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
}

function opening() {
    return {
        event_id: randomUUID(),
        opened_at: new Date().toISOString(),
        qr_id: 'home-hero-en',
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'accounts-launch',
        utm_content: 'creative-a',
        attribution_origin: 'current_url',
        attribution_adjustment: 'none',
    }
}

async function captures(uuid: string): Promise<CapturedEvent[]> {
    try {
        return (await readFile(sink!, 'utf8'))
            .trim()
            .split('\n')
            .filter(Boolean)
            .map((line) => JSON.parse(line) as CapturedEvent)
            .filter((event) => event.body.uuid === uuid)
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
        throw error
    }
}

test.describe('actual production-mode collector with isolated fetch sink', () => {
    test.skip(!enabled, 'Requires the coordinated second Next runtime and capture preload')
    test.beforeEach(async () => {
        expect(sink, 'MARKETING_QR_CAPTURE_FILE must match the server preload').toBeTruthy()
        await writeFile(`${sink}.mode`, 'ok')
    })
    test.afterEach(async () => {
        if (sink) await writeFile(`${sink}.mode`, 'ok')
    })

    test('fixed retries retain UUID/time/anonymous ID and do not forward visitor identity', async ({ request }) => {
        const body = opening()
        const headers = {
            ...canonicalHeaders,
            Cookie: 'account=synthetic-secret',
            Referer: 'https://example.invalid/send/private-secret',
            'X-Forwarded-For': '192.0.2.42',
        }
        for (let attempt = 0; attempt < 2; attempt++) {
            const response = await request.post('/api/marketing-qr/open', { headers, data: body })
            expect(response.status(), 'The request must reach Next with the canonical origin').toBe(204)
        }
        await expect.poll(async () => (await captures(body.event_id)).length).toBe(2)
        const recorded = await captures(body.event_id)
        expect(recorded[0].body).toEqual(recorded[1].body)
        for (const delivery of recorded) {
            expect(delivery.url).toBe('https://eu.i.posthog.com/i/v0/e/')
            expect(delivery.method).toBe('POST')
            expect(delivery.headers).toEqual({ 'content-type': 'application/json' })
            expect(Object.keys(delivery.body).sort()).toEqual(
                ['api_key', 'uuid', 'timestamp', 'event', 'distinct_id', 'properties'].sort()
            )
            expect(delivery.body).toMatchObject({
                api_key: 'phc_marketing_qr_test_only',
                uuid: body.event_id,
                timestamp: body.opened_at,
                event: 'marketing_qr_opened',
                distinct_id: `marketing-qr:${body.event_id}`,
                properties: {
                    qr_id: 'home-hero-en',
                    utm_campaign: 'accounts-launch',
                    $process_person_profile: false,
                    $geoip_disable: true,
                },
            })
            const serialized = JSON.stringify(delivery)
            for (const secret of [
                'synthetic-secret',
                'private-secret',
                '192.0.2.42',
                '$ip',
                '$device_id',
                '$current_url',
            ]) {
                expect(serialized).not.toContain(secret)
            }
        }
    })

    for (const mode of ['reject', 'http-error', 'timeout']) {
        test(`${mode} collector returns 204 without waiting for delivery`, async ({ request }) => {
            const body = opening()
            await writeFile(`${sink}.mode`, mode)
            const started = Date.now()
            const response = await request.post('/api/marketing-qr/open', { headers: canonicalHeaders, data: body })
            expect(response.status()).toBe(204)
            expect(Date.now() - started).toBeLessThan(1500)
            await expect.poll(async () => (await captures(body.event_id)).length).toBe(1)
            expect((await captures(body.event_id))[0].mode).toBe(mode)
        })
    }

    for (const [name, headers] of [
        ['DNT', { DNT: '1' }],
        ['GPC', { 'Sec-GPC': '1' }],
        ['prefetch', { Purpose: 'prefetch' }],
        ['preview', { 'User-Agent': 'WhatsApp/2.0' }],
    ] as const) {
        test(`${name} request is acknowledged without collector submission`, async ({ request }) => {
            const body = opening()
            const response = await request.post('/api/marketing-qr/open', {
                headers: { ...canonicalHeaders, ...headers },
                data: body,
            })
            expect(response.status()).toBe(204)
            // A subsequent eligible event establishes that after() work has run.
            const marker = opening()
            await request.post('/api/marketing-qr/open', { headers: canonicalHeaders, data: marker })
            await expect.poll(async () => (await captures(marker.event_id)).length).toBe(1)
            expect(await captures(body.event_id)).toEqual([])
        })
    }
})
