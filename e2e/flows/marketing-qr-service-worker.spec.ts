import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const entry = '/q/home-hero-en'
const endpoint = '/api/marketing-qr/open'
const staleBody = 'Stale marketing QR response seeded by QA'

test.use({ serviceWorkers: 'allow' })

test('active generated service worker keeps QR documents and opening POSTs on the network', async ({
    page,
    context,
}) => {
    test.setTimeout(90_000)
    const arrivalLog = process.env.MARKETING_QR_REQUEST_LOG
    expect(arrivalLog, 'Start the local server with the isolated marketing QR request observer').toBeTruthy()

    // Supply an inert client without loading the app or executing a QR handoff.
    // Remove routing before registration so every tested request uses the network.
    const bootstrap = '**/__marketing-qr-sw-qa'
    await page.route(bootstrap, (route) =>
        route.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><title>Marketing QR service worker QA</title>',
        })
    )
    await page.goto('/__marketing-qr-sw-qa')
    await page.unroute(bootstrap)
    await page.evaluate(async () => {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        await navigator.serviceWorker.ready
        if (!navigator.serviceWorker.controller) {
            await new Promise<void>((resolve) => {
                navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
            })
        }
    })
    await expect
        .poll(() =>
            page.evaluate(() => ({
                state: navigator.serviceWorker.controller?.state,
                path: new URL(navigator.serviceWorker.controller!.scriptURL).pathname,
            }))
        )
        .toEqual({ state: 'activated', path: '/sw.js' })

    // "pages" is the installed Serwist defaultCache HTML cache. The header on
    // the fetch below would select it if the explicit NetworkOnly rule vanished.
    await page.evaluate(
        async ({ entry, staleBody }) => {
            const cache = await caches.open('pages')
            await cache.put(entry, new Response(staleBody, { headers: { 'Content-Type': 'text/html' } }))
        },
        { entry, staleBody }
    )
    const qrCacheEntries = () =>
        page.evaluate(async (entry) => {
            const matches: Array<{ cache: string; url: string; body: string }> = []
            for (const name of await caches.keys()) {
                const cache = await caches.open(name)
                for (const key of await cache.keys()) {
                    if (new URL(key.url).pathname === entry) {
                        matches.push({ cache: name, url: key.url, body: await (await cache.match(key))!.text() })
                    }
                }
            }
            return matches.sort((left, right) =>
                `${left.cache}:${left.url}`.localeCompare(`${right.cache}:${right.url}`)
            )
        }, entry)
    const seededEntries = await qrCacheEntries()
    expect(seededEntries).toEqual([{ cache: 'pages', url: new URL(entry, page.url()).href, body: staleBody }])

    const nonces: string[] = []
    for (let attempt = 0; attempt < 2; attempt++) {
        const responsePromise = page.waitForResponse(
            (response) => new URL(response.url()).pathname === entry && response.request().method() === 'GET'
        )
        const document = await page.evaluate(async (entry) => {
            const response = await fetch(entry, { headers: { 'Content-Type': 'text/html' } })
            return {
                status: response.status,
                body: await response.text(),
                csp: response.headers.get('content-security-policy'),
                cacheControl: response.headers.get('cache-control'),
            }
        }, entry)
        expect((await responsePromise).fromServiceWorker()).toBe(true)
        expect(document.status).toBe(200)
        expect(document.cacheControl).toContain('no-store')
        expect(document.body).not.toContain(staleBody)
        const nonce = document.body.match(/<script nonce="([^"]+)"/)?.[1]
        expect(nonce).toBeTruthy()
        expect(document.csp).toContain(`'nonce-${nonce}'`)
        nonces.push(nonce!)
    }
    expect(nonces[0]).not.toBe(nonces[1])
    expect(await qrCacheEntries()).toEqual(seededEntries)

    // A cached fallback must also remain unavailable when the network fails.
    await context.setOffline(true)
    try {
        expect(
            await page.evaluate(async (entry) => {
                try {
                    await fetch(entry, { headers: { 'Content-Type': 'text/html' } })
                    return 'resolved'
                } catch {
                    return 'network-error'
                }
            }, entry)
        ).toBe('network-error')
    } finally {
        await context.setOffline(false)
    }
    expect(await qrCacheEntries()).toEqual(seededEntries)

    const body = {
        event_id: randomUUID(),
        opened_at: new Date().toISOString(),
        qr_id: 'home-hero-en',
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'accounts-launch',
        attribution_origin: 'current_url',
        attribution_adjustment: 'none',
    }
    const postResponse = page.waitForResponse(
        (response) => new URL(response.url()).pathname === endpoint && response.request().method() === 'POST'
    )
    expect(
        await page.evaluate(
            async ({ endpoint, body }) => {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    credentials: 'omit',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                })
                return { status: response.status, body: await response.text() }
            },
            { endpoint, body }
        )
    ).toEqual({ status: 204, body: '' })
    expect((await postResponse).fromServiceWorker()).toBe(true)
    await expect
        .poll(async () => {
            const receipts = (await readFile(arrivalLog!, 'utf8'))
                .split('\n')
                .filter(Boolean)
                .map((line) => JSON.parse(line) as { event_id: string; status: number })
            return receipts.filter((receipt) => receipt.event_id === body.event_id)
        })
        .toEqual([{ event_id: body.event_id, status: 204 }])
    expect(await qrCacheEntries()).toEqual(seededEntries)
})
