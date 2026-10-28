import { expect, test, type Browser, type BrowserContext, type Page, type Request } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { decodeQr } from '../marketing-qr-decode'

const token = process.env.MARKETING_QR_TEST_TOKEN ?? 'phc_marketing_qr_test_only'
const preferenceKey = `__ph_opt_in_out_${token}`
const desktopUA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const androidUA =
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
const iphoneUA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const qrPath = '/q/home-hero-en?s=google&m=cpc&c=accounts-launch&n=creative-a&o=current_url&a=none'
const capturePath = '/api/marketing-qr/open'

async function captureReviewShot(page: Page, name: string) {
    if (process.env.MARKETING_QR_SHOTS !== 'true') return
    const directory = path.resolve(__dirname, '../__shots__/marketing-qr')
    await mkdir(directory, { recursive: true })
    await page.screenshot({
        path: path.join(directory, `${test.info().project.name}-${name}.png`),
        fullPage: false,
        animations: 'disabled',
    })
}

async function guardedContext(browser: Browser, baseURL: string, options: Parameters<Browser['newContext']>[0] = {}) {
    const context = await browser.newContext({
        baseURL,
        userAgent: desktopUA,
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        serviceWorkers: 'block',
        ...options,
    })
    const origin = new URL(baseURL).origin
    // Leave the real keepalive POST unintercepted. Routing it through CDP can
    // cancel it when its initiating document immediately navigates away.
    await context.route(
        (url) => !(url.origin === origin && url.pathname === capturePath),
        async (route) => {
            const url = new URL(route.request().url())
            if (url.origin === origin) {
                if (url.pathname.startsWith('/api/') && url.pathname !== capturePath) {
                    await route.abort('blockedbyclient')
                    return
                }
                if (url.pathname.startsWith('/relay/')) {
                    await route.fulfill({ json: { featureFlags: {}, featureFlagPayloads: {} } })
                    return
                }
                if (url.pathname.startsWith('/monitoring')) {
                    await route.fulfill({ status: 200, body: '{}' })
                    return
                }
                await route.continue()
                return
            }
            // The suite may observe a store navigation, but never visits a store,
            // an account service, an analytics collector or a third-party script.
            if (url.hostname === 'apps.apple.com' || url.hostname === 'play.google.com') {
                await route.fulfill({ contentType: 'text/html', body: '<p>Store navigation intercepted by QA.</p>' })
                return
            }
            await route.abort('blockedbyclient')
        }
    )
    return context
}

function openingRequests(context: BrowserContext) {
    const requests: Request[] = []
    context.on('request', (request) => {
        if (new URL(request.url()).pathname === capturePath && request.method() === 'POST') requests.push(request)
    })
    return requests
}

async function isolateContinuation(context: BrowserContext) {
    await context.route('**/app?**', (route) =>
        route.fulfill({ contentType: 'text/html', body: '<p>Approved continuation reached.</p>' })
    )
}

test.describe('marketing QR browser handoff', () => {
    test('real standalone script posts anonymously then preserves campaign in its continuation', async ({
        browser,
        baseURL,
    }) => {
        const arrivalLog = process.env.MARKETING_QR_REQUEST_LOG
        // The observer's explicitly marked /app stub avoids the app layout.
        // Zero Playwright routes means the keepalive transport is unmodified.
        const context = arrivalLog
            ? await browser.newContext({
                  baseURL,
                  userAgent: desktopUA,
                  serviceWorkers: 'block',
                  extraHTTPHeaders: { 'x-marketing-qr-qa-continuation-stub': '1' },
              })
            : await guardedContext(browser, baseURL!)
        try {
            if (!arrivalLog) await isolateContinuation(context)
            await context.addCookies([{ name: 'qa-account-cookie', value: 'must-not-cross', url: baseURL! }])
            const requests = openingRequests(context)
            const page = await context.newPage()
            const responsePromise = arrivalLog
                ? undefined
                : page.waitForResponse((response) => new URL(response.url()).pathname === capturePath)
            await page.goto(qrPath)
            await expect(page).toHaveURL(/\/app\?marketing_qr=/)
            await expect.poll(() => requests.length).toBe(1)
            const request = requests[0]
            if (arrivalLog) {
                const eventId = request.postDataJSON().event_id
                await expect
                    .poll(async () => {
                        const rows = (await readFile(arrivalLog, 'utf8'))
                            .split('\n')
                            .filter(Boolean)
                            .map((line) => JSON.parse(line))
                        return rows.filter((row) => row.event_id === eventId).map((row) => row.status)
                    })
                    .toEqual([204])
            } else expect((await responsePromise!).status()).toBe(204)
            const headers = await request.allHeaders()
            expect(headers.cookie).toBeUndefined()
            expect(headers.referer).toBeUndefined()
            expect(headers.origin).toBe(new URL(baseURL!).origin)
            expect(request.postDataJSON()).toMatchObject({
                qr_id: 'home-hero-en',
                utm_source: 'google',
                utm_medium: 'cpc',
                utm_campaign: 'accounts-launch',
                utm_content: 'creative-a',
                attribution_origin: 'current_url',
                attribution_adjustment: 'none',
            })
            const next = new URL(page.url())
            expect(next.searchParams.get('marketing_qr')).toBe('home-hero-en')
            expect(next.searchParams.get('utm_campaign')).toBe('accounts-launch')
            expect(next.searchParams.get('utm_content')).toBe('creative-a')
            expect(next.searchParams.get('qr_analytics')).toBe('allow')
            for (const forbidden of ['wid', 'at', 'invite', 'gclid', 'code', 'dest']) {
                expect(next.searchParams.has(forbidden), forbidden).toBe(false)
            }
        } finally {
            await context.close()
        }
    })

    const preferenceCases = ['denied', 'malformed', 'cookie-conflict', 'storage-failure', 'dnt', 'gpc'] as const
    for (const preference of preferenceCases) {
        test(`${preference} skips capture and marketing context without blocking continuation`, async ({
            browser,
            baseURL,
        }) => {
            const context = await guardedContext(browser, baseURL!)
            try {
                await isolateContinuation(context)
                if (preference === 'cookie-conflict') {
                    await context.addCookies([{ name: preferenceKey, value: '0', url: baseURL! }])
                }
                await context.addInitScript(
                    ({ key, preference }) => {
                        if (preference === 'denied') localStorage.setItem(key, '0')
                        if (preference === 'malformed') localStorage.setItem(key, 'invalid-preference')
                        if (preference === 'cookie-conflict') localStorage.setItem(key, '1')
                        if (preference === 'storage-failure') {
                            Object.defineProperty(window, 'localStorage', {
                                get() {
                                    throw new DOMException('Storage blocked for QA', 'SecurityError')
                                },
                            })
                        }
                        if (preference === 'dnt') Object.defineProperty(navigator, 'doNotTrack', { value: '1' })
                        if (preference === 'gpc')
                            Object.defineProperty(navigator, 'globalPrivacyControl', { value: true })
                    },
                    { key: preferenceKey, preference }
                )
                const requests = openingRequests(context)
                const page = await context.newPage()
                await page.goto(qrPath)
                await expect(page).toHaveURL(/\/app\?marketing_qr=/)
                expect(requests).toHaveLength(0)
                const next = new URL(page.url())
                expect(next.searchParams.get('qr_analytics')).toBe('deny')
                expect([...next.searchParams.keys()].filter((key) => key.startsWith('utm_'))).toEqual([])
            } finally {
                await context.close()
            }
        })
    }

    test('no JavaScript leaves working untagged store choices and produces no opening event', async ({
        browser,
        baseURL,
    }) => {
        const context = await guardedContext(browser, baseURL!, {
            javaScriptEnabled: false,
            viewport: { width: 375, height: 667 },
        })
        try {
            const requests = openingRequests(context)
            const page = await context.newPage()
            await page.goto(qrPath)
            await expect(page.locator('a[href*="apps.apple.com"]').first()).toBeVisible()
            await expect(page.locator('a[href*="play.google.com"]').first()).toBeVisible()
            expect(page.url()).toContain('/q/home-hero-en')
            expect(requests).toHaveLength(0)
            await captureReviewShot(page, 'no-js-375x667')
            for (const href of await page
                .locator('a')
                .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''))) {
                expect(href).not.toContain('accounts-launch')
                expect(href).not.toContain('referrer=')
            }
        } finally {
            await context.close()
        }
    })

    for (const behavior of ['blocked', 'pending'] as const) {
        test(`${behavior} capture does not hold navigation`, async ({ browser, baseURL }) => {
            const context = await guardedContext(browser, baseURL!)
            let release: (() => void) | undefined
            const held = new Promise<void>((resolve) => (release = resolve))
            try {
                await isolateContinuation(context)
                const requests = openingRequests(context)
                await context.route(`**${capturePath}`, async (route) => {
                    if (behavior === 'pending') await held
                    await route.abort('failed').catch(() => {})
                })
                const page = await context.newPage()
                await page.goto(qrPath)
                await expect(page).toHaveURL(/\/app\?marketing_qr=/, { timeout: 5000 })
                await expect.poll(() => requests.length, { timeout: 5000 }).toBe(1)
            } finally {
                release?.()
                await context.close()
            }
        })
    }

    test('two independent opens have different event IDs without persistent scanner identity', async ({
        browser,
        baseURL,
    }) => {
        const context = await guardedContext(browser, baseURL!)
        try {
            await isolateContinuation(context)
            const requests = openingRequests(context)
            const page = await context.newPage()
            for (let i = 0; i < 2; i++) {
                await page.goto(qrPath)
                await expect(page).toHaveURL(/\/app\?marketing_qr=/)
                await expect.poll(() => requests.length).toBe(i + 1)
            }
            const ids = requests.map((request) => request.postDataJSON().event_id)
            expect(ids[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i)
            expect(ids[1]).not.toBe(ids[0])
            expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([])
            expect(await context.cookies()).toEqual([])
        } finally {
            await context.close()
        }
    })

    for (const suffix of [
        '&gclid=forbidden',
        '&s=meta',
        '&redirect_uri=https://example.invalid',
        '&c=bad%40mail.invalid',
    ]) {
        test(`hostile query ${suffix} continues without recording it`, async ({ browser, baseURL }) => {
            const context = await guardedContext(browser, baseURL!)
            try {
                await isolateContinuation(context)
                const requests = openingRequests(context)
                const page = await context.newPage()
                await page.goto(`${qrPath}${suffix}`)
                await expect(page).toHaveURL(/\/app\?marketing_qr=/)
                expect(requests).toHaveLength(0)
                expect(new URL(page.url()).searchParams.get('qr_analytics')).toBe('deny')
                expect(page.url()).not.toContain('example.invalid')
                expect(page.url()).not.toContain('forbidden')
            } finally {
                await context.close()
            }
        })
    }
})

test.describe('automated marketing QR navigation', () => {
    for (const header of [{ Purpose: 'prefetch' }, { 'User-Agent': 'WhatsApp/2.0' }] as Record<string, string>[]) {
        test(`${Object.keys(header)[0]} filtered request cannot trigger capture in a browser`, async ({
            browser,
            baseURL,
        }) => {
            const context = await guardedContext(browser, baseURL!, {
                ...(header['User-Agent'] ? { userAgent: header['User-Agent'] } : { extraHTTPHeaders: header }),
            })
            try {
                await isolateContinuation(context)
                const requests = openingRequests(context)
                const page = await context.newPage()
                await page.goto(qrPath)
                await expect(page).toHaveURL(/\/app\?marketing_qr=/)
                expect(new URL(page.url()).searchParams.get('qr_analytics')).toBe('deny')
                expect(requests).toHaveLength(0)
            } finally {
                await context.close()
            }
        })
    }

    test('prerender does not capture or navigate until activation', async ({ browser, baseURL }) => {
        const context = await guardedContext(browser, baseURL!)
        try {
            await isolateContinuation(context)
            await context.addInitScript(() => {
                Object.defineProperty(document, 'prerendering', { value: true, writable: true })
            })
            const requests = openingRequests(context)
            const page = await context.newPage()
            await page.goto(qrPath)
            expect(new URL(page.url()).pathname).toBe('/q/home-hero-en')
            expect(requests).toHaveLength(0)
            await page.evaluate(() => {
                Object.defineProperty(document, 'prerendering', { value: false })
                document.dispatchEvent(new Event('prerenderingchange'))
            })
            await expect(page).toHaveURL(/\/app\?marketing_qr=/)
            await expect.poll(() => requests.length).toBe(1)
        } finally {
            await context.close()
        }
    })
})

test.describe('rendered marketing QR', () => {
    test('homepage modal pixels decode and a fresh scanner receives the original campaign', async ({
        browser,
        baseURL,
    }) => {
        const desktop = await guardedContext(browser, baseURL!)
        let scanner: BrowserContext | undefined
        try {
            await desktop.addInitScript((key) => {
                localStorage.setItem('pwa-sunset', 'true')
                localStorage.setItem(key, '1')
            }, preferenceKey)
            const desktopJourney = '1508fc8b-ae6b-4a28-a9f0-d8bb85bd98fa'
            await desktop.addCookies([
                {
                    name: 'signupAttribution',
                    url: baseURL!,
                    value: encodeURIComponent(
                        JSON.stringify({
                            schemaVersion: '1',
                            journeyId: desktopJourney,
                            platform: 'web',
                            analyticsState: 'enabled',
                            captureMethod: 'browser',
                            firstTouch: {
                                occurredAt: new Date().toISOString(),
                                utmSource: 'instagram',
                                utmMedium: 'social',
                                utmCampaign: 'older-campaign',
                                path: '/',
                            },
                        })
                    ),
                },
            ])
            const page = await desktop.newPage()
            await page.goto(
                '/?utm_source=google&utm_medium=cpc&utm_campaign=accounts-launch&utm_content=creative-a&gclid=click-secret'
            )
            const cta = page.getByTestId('landing-download-cta').getByRole('link')
            await expect(cta).toBeVisible()
            await cta.click()
            const dialog = page.getByRole('dialog')
            await expect(dialog).toBeVisible()
            const qr = dialog.locator('[data-qr-url]').first()
            await expect(qr).toBeVisible()
            await captureReviewShot(page, 'home-modal-enabled')
            const decoded = await decodeQr(desktop, qr, baseURL!)
            const url = new URL(decoded)
            expect(url.origin).toBe(new URL(baseURL!).origin)
            expect(url.pathname).toBe('/home')
            expect(url.searchParams.get('app_entry')).toBe('1')
            expect(url.searchParams.get('marketing_qr')).toBe('home-hero-en')
            expect(Buffer.byteLength(decoded)).toBeLessThanOrEqual(200)
            expect(url.searchParams.get('s')).toBe('google')
            expect(url.searchParams.get('m')).toBe('cpc')
            expect(url.searchParams.get('c')).toBe('accounts-launch')
            expect(url.searchParams.get('n')).toBe('creative-a')
            expect(url.searchParams.get('o')).toBe('current_url')
            expect(decoded).not.toContain(desktopJourney)
            expect(decoded).not.toContain('click-secret')

            scanner = await guardedContext(browser, baseURL!, { userAgent: iphoneUA })
            await isolateContinuation(scanner)
            const events = openingRequests(scanner)
            const phone = await scanner.newPage()
            await phone.goto(decoded)
            await expect(phone).toHaveURL(/\/app\?marketing_qr=/)
            await expect.poll(() => events.length).toBe(1)
            expect(events[0].postDataJSON().utm_campaign).toBe('accounts-launch')
        } finally {
            await scanner?.close()
            await desktop.close()
        }
    })

    test('established SEO campaign source survives rendered QR and fresh scanner opening', async ({
        browser,
        baseURL,
    }) => {
        const desktop = await guardedContext(browser, baseURL!)
        let scanner: BrowserContext | undefined
        try {
            await desktop.addInitScript((key) => {
                localStorage.setItem('pwa-sunset', 'true')
                localStorage.setItem(key, '1')
            }, preferenceKey)
            const page = await desktop.newPage()
            await page.goto('/?utm_source=compare&utm_medium=content&utm_campaign=wise&utm_content=hero')
            await page.getByTestId('landing-download-cta').getByRole('link').click()
            const qr = page.getByRole('dialog').locator('[data-qr-url]')
            await expect(qr).toBeVisible()
            const decoded = await decodeQr(desktop, qr, baseURL!)
            const url = new URL(decoded)
            expect(url.searchParams.get('s')).toBe('compare')
            expect(url.searchParams.get('m')).toBe('content')
            expect(url.searchParams.get('c')).toBe('wise')
            scanner = await guardedContext(browser, baseURL!)
            await isolateContinuation(scanner)
            const events = openingRequests(scanner)
            const phone = await scanner.newPage()
            await phone.goto(decoded)
            await expect(phone).toHaveURL(/\/app\?marketing_qr=/)
            await expect.poll(() => events.length).toBe(1)
            expect(events[0].postDataJSON()).toMatchObject({
                utm_source: 'compare',
                utm_medium: 'content',
                utm_campaign: 'wise',
                utm_content: 'hero',
                attribution_origin: 'current_url',
            })
        } finally {
            await scanner?.close()
            await desktop.close()
        }
    })

    test('long labels produce a scannable QR within the all-in byte budget', async ({ browser, baseURL }) => {
        const context = await guardedContext(browser, baseURL!)
        try {
            await context.addInitScript((key) => {
                localStorage.setItem('pwa-sunset', 'true')
                localStorage.setItem(key, '1')
            }, preferenceKey)
            const campaign = `${'autumn-'.repeat(8)}campaign`
            // '+' is a valid label character and percent-encodes to three bytes.
            const content = `creative+${'z+'.repeat(27)}z`
            const page = await context.newPage()
            await page.goto(
                `/?utm_source=google&utm_medium=cpc&utm_campaign=${campaign}&utm_content=${encodeURIComponent(content)}`
            )
            await page.getByTestId('landing-download-cta').getByRole('link').click()
            const qr = page.getByRole('dialog').locator('[data-qr-url]')
            await expect(qr).toBeVisible()
            const decoded = await decodeQr(context, qr, baseURL!)
            const url = new URL(decoded)
            expect(Buffer.byteLength(decoded)).toBeLessThanOrEqual(200)
            expect(url.searchParams.get('c')).toBe(campaign)
            expect(url.searchParams.has('n')).toBe(false)
            expect(url.searchParams.get('a')).toBe('content_trimmed')
        } finally {
            await context.close()
        }
    })

    for (const [route, campaign, slots] of [
        ['/qr-payments/argentina', 'qr-ar', ['h', 'c']],
        ['/qr-payments/brazil', 'qr-br', ['h', 'c', 'w']],
    ] as const) {
        test(`${route} inline QR pixels retain campaign and slot defaults`, async ({ browser, baseURL }) => {
            const context = await guardedContext(browser, baseURL!)
            try {
                await context.addInitScript((key) => {
                    localStorage.setItem('pwa-sunset', 'true')
                    localStorage.setItem(key, '1')
                }, preferenceKey)
                const page = await context.newPage()
                await page.goto(route)
                const qrs = page.locator('[data-qr-url]')
                await expect(qrs.first()).toBeVisible()
                const decodedSlots = new Set<string>()
                for (const qr of await qrs.all()) {
                    if (!(await qr.isVisible())) continue
                    await qr.scrollIntoViewIfNeeded()
                    const decoded = await decodeQr(context, qr, baseURL!)
                    const url = new URL(decoded)
                    expect(Buffer.byteLength(decoded)).toBeLessThanOrEqual(200)
                    const expectedIdPrefix = route.endsWith('argentina') ? 'qr-argentina' : 'qr-brazil'
                    const qrId = url.searchParams.get('marketing_qr') ?? ''
                    expect(url.pathname).toBe('/home')
                    expect(qrId).toMatch(new RegExp(`^${expectedIdPrefix}-(hero-sticker|close-sticker|ways-in)-en$`))
                    const expectedSlot = qrId.includes('hero-sticker')
                        ? 'h'
                        : qrId.includes('close-sticker')
                          ? 'c'
                          : 'w'
                    if (expectedSlot === 'h') await captureReviewShot(page, `inline-${expectedIdPrefix}`)
                    // Defaults may be encoded by registration alone. Prove their
                    // effective meaning in a separate scanner, without importing
                    // the production URL parser into the test oracle.
                    const scanner = await guardedContext(browser, baseURL!)
                    try {
                        await isolateContinuation(scanner)
                        const events = openingRequests(scanner)
                        const phone = await scanner.newPage()
                        await phone.goto(decoded)
                        await expect(phone).toHaveURL(/\/app\?marketing_qr=/)
                        await expect.poll(() => events.length).toBe(1)
                        expect(events[0].postDataJSON()).toMatchObject({
                            qr_id: qrId,
                            utm_source: 'star-lp',
                            utm_medium: 'content',
                            utm_campaign: campaign,
                            utm_content: expectedSlot,
                            attribution_origin: 'placement_default',
                        })
                    } finally {
                        await scanner.close()
                    }
                    decodedSlots.add(expectedSlot)
                }
                expect([...decodedSlots].sort()).toEqual([...slots].sort())
            } finally {
                await context.close()
            }
        })
    }
})

test.describe('marketing store continuation', () => {
    const appPath =
        '/app?marketing_qr=home-hero-en&qr_analytics=allow&utm_source=google&utm_medium=cpc&utm_campaign=accounts-launch&utm_content=creative-a'

    test('Android continuation contains campaign-bearing install referrer', async ({ browser, baseURL }) => {
        const context = await guardedContext(browser, baseURL!, { userAgent: androidUA })
        try {
            await context.addInitScript((key) => {
                localStorage.setItem('pwa-sunset', 'true')
                localStorage.setItem(key, '1')
            }, preferenceKey)
            const page = await context.newPage()
            await page.goto(appPath)
            await expect(page).toHaveURL(/^https:\/\/play\.google\.com\//)
            const referrer = new URL(page.url()).searchParams.get('referrer')
            expect(referrer).toBeTruthy()
            const payload = new URLSearchParams(referrer!)
            expect(payload.get('pnutdl')).toBe('1')
            expect(payload.get('utm_campaign')).toBe('accounts-launch')
            if (payload.has('dest')) expect(payload.get('dest')!).not.toMatch(/^\/(?:q|app)(?:[/?]|$)/)
        } finally {
            await context.close()
        }
    })

    test('iOS retains a deliberate tap before clipboard handoff', async ({ browser, baseURL }) => {
        const context = await guardedContext(browser, baseURL!, {
            userAgent: iphoneUA,
            viewport: { width: 375, height: 667 },
        })
        const writes: string[] = []
        try {
            await context.exposeBinding('__marketingQrClipboard', (_, text: string) => writes.push(text))
            await context.addInitScript((key) => {
                localStorage.setItem('pwa-sunset', 'true')
                localStorage.setItem(key, '1')
                Object.defineProperty(navigator, 'clipboard', {
                    value: {
                        writeText: async (text: string) =>
                            (
                                window as unknown as { __marketingQrClipboard: (text: string) => Promise<void> }
                            ).__marketingQrClipboard(text),
                    },
                })
            }, preferenceKey)
            const page = await context.newPage()
            await page.goto(appPath)
            const store = page.getByRole('button', { name: 'App Store', exact: true })
            await expect(store).toBeVisible()
            expect(new URL(page.url()).pathname).toBe('/app')
            expect(writes).toEqual([])
            await captureReviewShot(page, 'ios-store-375x667')
            await store.click()
            await expect.poll(() => writes.length).toBe(1)
            expect(writes[0]).toContain('pnutdl=1')
        } finally {
            await context.close()
        }
    })

    test('store page rechecks a newly denied preference before building the install handoff', async ({
        browser,
        baseURL,
    }) => {
        const context = await guardedContext(browser, baseURL!, { userAgent: androidUA })
        try {
            await context.addInitScript((key) => {
                localStorage.setItem('pwa-sunset', 'true')
                localStorage.setItem(key, '0')
            }, preferenceKey)
            const page = await context.newPage()
            await page.goto(appPath)
            await expect(page).toHaveURL(/^https:\/\/play\.google\.com\//)
            expect(new URL(page.url()).searchParams.has('referrer')).toBe(false)
        } finally {
            await context.close()
        }
    })

    test('an already-issued QR still offers stores when the migration flag is off', async ({ browser, baseURL }) => {
        const context = await guardedContext(browser, baseURL!)
        try {
            const page = await context.newPage()
            await page.goto(appPath)
            await expect(page.getByRole('button', { name: 'App Store', exact: true })).toBeVisible()
            await expect(page.getByRole('button', { name: 'Google Play', exact: true })).toBeVisible()
            await expect(page.getByText('This page could not be found.')).toHaveCount(0)
            expect(new URL(page.url()).pathname).toBe('/app')
        } finally {
            await context.close()
        }
    })
})
