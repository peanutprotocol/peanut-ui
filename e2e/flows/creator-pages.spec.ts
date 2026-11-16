/**
 * Every real creator page on the real /go route, in an in-app browser: it should be in the first
 * HTML and work without JavaScript, and its tap event names the variant the visitor saw.
 *
 * Same switches and lookup stub as go-links.spec.ts, so it also skips in the shared regression run.
 * Both specs listen on the stub's port: run each alone.
 *
 *   NEXT_PUBLIC_VERCEL_ENV=production NEXT_PUBLIC_POSTHOG_KEY=phc_go_links_e2e npm run build
 *   GO_LINKS_E2E_PAGE=1 PEANUT_API_URL=http://127.0.0.1:3097 \
 *     npx playwright test e2e/flows/creator-pages.spec.ts --config=playwright.regression.config.ts
 *
 * The stub's link id for `juanacervio` is not one of the engine's test pages, so the engine asks
 * src/features/creator-pages/registry.ts, as in production. The sticky cookie picks the variant, as it does for a returning
 * visitor. The first two tests of each variant also run against `next dev`; the tap event needs
 * the build, because PostHog does not start in development.
 */
import { expect, test, type Page } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { gunzipSync } from 'node:zlib'

const apiUrl = process.env.PEANUT_API_URL ?? ''
const enabled = process.env.GO_LINKS_E2E_PAGE === '1' && apiUrl.startsWith('http://127.0.0.1:')
const CREATOR = 'juanacervio'
const LINK_ID = `invite_${'a'.repeat(64)}`
const EXPERIMENT = 'nita-2026-11-a'
const VARIANTS = ['a1', 'g2', 'e1']
/**
 * The engine renders the page under `<Suspense fallback={null}>` (CreatorPageBoundary). React sends
 * a boundary whose HTML is over 12,800 bytes (`progressiveChunkSize`) as a separate hidden block,
 * `<div hidden id="S:0">`, even when nothing in it suspends, and an inline script reveals it. A page
 * cannot opt out, so every page stays under that size.
 *
 * Sizes of `<main>` with the Instagram iPhone user agent, 15 Nov 2026: A1 10,101 bytes, E1 10,072,
 * G2 1,901. If a page grows past the limit its two checks below fail. Only list a variant here when
 * shipping it hidden-without-script is a decision, not an accident.
 */
const HIDDEN_WITHOUT_SCRIPT: string[] = []
const HIDDEN_REASON = 'the engine Suspense boundary streams a page over 12.8 kB in a hidden block'
const instagramUA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0.0 (iPhone14,5; iOS 18_0; en_US; en; scale=3.00; 1170x2532; 600000000)'

test.skip(!enabled, 'needs GO_LINKS_E2E_PAGE=1 and PEANUT_API_URL=http://127.0.0.1:<port> (see the header)')
test.use({ userAgent: instagramUA, viewport: { width: 375, height: 667 } })
// One worker at a time owns the stub's port; the tests do not depend on each other.
test.describe.configure({ mode: 'default' })

let stub: Server
test.beforeAll(async () => {
    stub = createServer((request, response) => {
        const found = request.url === `/tracked-links/invites/${CREATOR}`
        response.writeHead(found ? 200 : 404, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify(found ? { linkId: LINK_ID } : { error: 'Link not found' }))
    })
    await new Promise<void>((resolve) => stub.listen(Number(new URL(apiUrl).port), '127.0.0.1', resolve))
})
test.afterAll(async () => {
    await new Promise((resolve) => stub?.close(resolve))
})

const stickyCookie = (variant: string) => `${EXPERIMENT}.${variant}`

/** The store button a visitor sees first. A1 also has a pinned one, hidden on the first screen. */
function firstButton(page: Page) {
    return page.locator('main a[data-cta-position]:visible').first()
}

type PosthogEvent = { event?: string; properties?: Record<string, unknown> }

/** posthog-js sends gzip, plain JSON or a base64 form field, one event or a batch. */
function posthogEvents(body: Buffer | null): PosthogEvent[] {
    if (!body) return []
    const readers = [
        () => JSON.parse(gunzipSync(new Uint8Array(body)).toString('utf8')),
        () => JSON.parse(body.toString('utf8')),
        () =>
            JSON.parse(
                Buffer.from(
                    decodeURIComponent(new URLSearchParams(body.toString('utf8')).get('data') ?? ''),
                    'base64'
                ).toString('utf8')
            ),
    ]
    for (const read of readers) {
        try {
            const decoded = read()
            return Array.isArray(decoded) ? decoded : (decoded.batch ?? [decoded])
        } catch {}
    }
    return []
}

for (const variant of VARIANTS) {
    test.describe(`variant ${variant}`, () => {
        test('the page is in the first HTML, not in a block that a script must reveal', async ({ request }) => {
            test.fail(HIDDEN_WITHOUT_SCRIPT.includes(variant), HIDDEN_REASON)
            const response = await request.get(`/go/${CREATOR}/ig`, {
                headers: { 'user-agent': instagramUA, cookie: `cpv_${CREATOR}=${stickyCookie(variant)}` },
            })
            expect(response.status()).toBe(200)
            const html = await response.text()

            const main = html.indexOf('<main')
            expect(main).toBeGreaterThan(-1)
            // The label of the requesting phone is in the HTML, with the variant in its link.
            expect(html).toMatch(/<a [^>]*data-cta-position="/)
            expect(html).toContain('App Store')
            expect(html).toContain(`tl_v=${variant}`)
            expect(html).toContain('<title>Invitación de Nita</title>')
            // A streamed boundary is `<div hidden id="S:0">`, with `<template id="B:0">` in its place.
            expect(html).not.toMatch(/<template id="B:/)
            expect(html.slice(0, main)).not.toMatch(/<div hidden[^>]*id="S:/)
        })

        test('with JavaScript off the button is visible and leads to the handoff', async ({ browser, baseURL }) => {
            test.fail(HIDDEN_WITHOUT_SCRIPT.includes(variant), HIDDEN_REASON)
            const context = await browser.newContext({
                baseURL,
                javaScriptEnabled: false,
                userAgent: instagramUA,
                viewport: { width: 375, height: 667 },
                serviceWorkers: 'block',
            })
            try {
                await context.addCookies([
                    { name: `cpv_${CREATOR}`, value: stickyCookie(variant), url: `${baseURL}/go` },
                ])
                const page = await context.newPage()
                const response = await page.goto(`/go/${CREATOR}/ig`)
                expect(response?.status()).toBe(200)
                await expect(page.locator('main')).toBeVisible({ timeout: 3_000 })

                const cta = firstButton(page)
                await expect(cta).toBeVisible()
                await expect(cta).toContainText('App Store')
                expect(new URL((await cta.getAttribute('href'))!, baseURL).searchParams.get('tl_v')).toBe(variant)

                await cta.click()
                await page.waitForURL(/\/app\?/)
                const app = new URL(page.url())
                expect(Object.fromEntries(app.searchParams)).toMatchObject({ tl: CREATOR, tl_s: 'ig', tl_v: variant })
            } finally {
                await context.close()
            }
        })

        test('the tap event names the variant that the button link carries', async ({ page, baseURL }) => {
            // posthog-js drops automated browsers as bots; this one stands in for a phone.
            await page.addInitScript(() =>
                Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false })
            )
            await page
                .context()
                .addCookies([{ name: `cpv_${CREATOR}`, value: stickyCookie(variant), url: `${baseURL}/go` }])
            const events: PosthogEvent[] = []
            // The fake project key must not reach PostHog: answer its requests here and read what they carry.
            await page.context().route(/\/relay\/|posthog\.com/, async (route) => {
                events.push(...posthogEvents(route.request().postDataBuffer()))
                await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' })
            })

            const response = await page.goto(`/go/${CREATOR}/ig`)
            expect(response?.status()).toBe(200)
            await expect(page.getByRole('dialog')).toHaveCount(0)

            const cta = firstButton(page)
            await expect(cta).toBeVisible()
            const link = new URL((await cta.getAttribute('href'))!, baseURL)
            expect(link.searchParams.get('tl_v')).toBe(variant)

            await cta.click()
            const taps = () => events.filter((event) => event.event === 'creator_page_cta_clicked')
            await expect.poll(() => taps().length).toBe(1)
            expect(taps()[0].properties).toMatchObject({
                page_variant: link.searchParams.get('tl_v'),
                page_experiment: link.searchParams.get('tl_e'),
                creator_username: CREATOR,
                link_id: LINK_ID,
                device_os: 'ios',
                in_app_browser: 'instagram',
            })
            expect(['hero', 'sticky', 'footer']).toContain(taps()[0].properties?.cta_position)
        })
    })
}
