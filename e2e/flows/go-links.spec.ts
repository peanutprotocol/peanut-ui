/**
 * /go creator links in an in-app browser: the page arm and the redirect arm.
 *
 * Needs a stubbed creator lookup and a build that sends the visit event, so it skips in the
 * shared regression run. Run it alone:
 *
 *   NEXT_PUBLIC_VERCEL_ENV=production NEXT_PUBLIC_POSTHOG_KEY=phc_go_links_e2e npm run build
 *   GO_LINKS_E2E_PAGE=1 PEANUT_API_URL=http://127.0.0.1:3097 \
 *     npx playwright test e2e/flows/go-links.spec.ts --config=playwright.regression.config.ts
 *
 * `next start` inherits both variables: the server's lookup goes to the stub below, and the
 * stub's link id for `alice` selects the engine's test page (src/features/tracked-links/e2e-creator-page.tsx).
 */
import { expect, test, type Page, type Request } from '@playwright/test'
import { createServer, type Server } from 'node:http'

const apiUrl = process.env.PEANUT_API_URL ?? ''
const enabled = process.env.GO_LINKS_E2E_PAGE === '1' && apiUrl.startsWith('http://127.0.0.1:')
const LINK_IDS: Record<string, string> = {
    alice: `invite_${'e'.repeat(64)}`,
    bob: `invite_${'b'.repeat(64)}`,
    // Selects the engine's test page that throws while it renders.
    carol: `invite_${'f'.repeat(64)}`,
}
const instagramUA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0.0 (iPhone14,5; iOS 18_0; en_US; en; scale=3.00; 1170x2532; 600000000)'

test.skip(!enabled, 'needs GO_LINKS_E2E_PAGE=1 and PEANUT_API_URL=http://127.0.0.1:<port> (see the header)')
test.use({ userAgent: instagramUA, viewport: { width: 375, height: 667 } })
// One worker owns the stub's port.
test.describe.configure({ mode: 'serial' })

let stub: Server
test.beforeAll(async () => {
    stub = createServer((request, response) => {
        const username = request.url?.match(/^\/tracked-links\/invites\/([a-z0-9]+)$/)?.[1]
        const linkId = username ? LINK_IDS[username] : undefined
        response.writeHead(linkId ? 200 : 404, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify(linkId ? { linkId } : { error: 'Link not found' }))
    })
    await new Promise<void>((resolve) => stub.listen(Number(new URL(apiUrl).port), '127.0.0.1', resolve))
})
test.afterAll(async () => {
    await new Promise((resolve) => stub?.close(resolve))
})

/** Every visit POST of this page, from any document it navigates through. */
async function recordVisits(page: Page): Promise<Record<string, unknown>[]> {
    const visits: Record<string, unknown>[] = []
    // The fake project key must not reach PostHog.
    await page.route(/posthog\.com/, (route) => route.abort())
    page.on('request', (request: Request) => {
        if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/tracked-links/open')
            visits.push(request.postDataJSON())
    })
    return visits
}

/** /app has finished its entry once it offers the stores. */
async function appEntryDone(page: Page) {
    await page.waitForURL(/\/app\?/)
    await expect(page.getByRole('button', { name: /App Store/ }).first()).toBeVisible()
}

test('a creator page counts one visit with its variant, and the CTA does not count again', async ({ page }) => {
    const visits = await recordVisits(page)
    const response = await page.goto('/go/alice/ig?utm_campaign=t')
    expect(response?.status()).toBe(200)
    expect(response?.headers()['cache-control']).toContain('no-store')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect.poll(() => visits.length).toBe(1)
    expect(visits[0]).toMatchObject({
        slug: 'alice',
        placement: 'ig',
        code: null,
        utm_campaign: 't',
        page_variant: 'e2e',
        page_experiment: 'e2e',
    })

    const cta = page.getByRole('link', { name: 'Get Peanut' })
    expect(await cta.getAttribute('href')).not.toContain('tl_seen')
    await cta.click()
    await appEntryDone(page)
    const app = new URL(page.url())
    expect(Object.fromEntries(app.searchParams)).toMatchObject({ tl: 'alice', tl_s: 'ig', tl_v: 'e2e', tl_e: 'e2e' })
    expect(visits).toHaveLength(1)
})

test('a creator without a page goes straight to /app with the tags', async ({ page }) => {
    const visits = await recordVisits(page)
    await page.goto('/go/bob/ig?utm_campaign=t')
    await appEntryDone(page)
    const app = new URL(page.url())
    expect(Object.fromEntries(app.searchParams)).toMatchObject({
        tl: 'bob',
        acq_invite: 'bob',
        tl_s: 'ig',
        utm_campaign: 't',
    })
    expect(app.searchParams.has('tl_v')).toBe(false)
    await expect.poll(() => visits.length).toBe(1)
    expect(visits[0]).toMatchObject({ slug: 'bob', placement: 'ig', utm_campaign: 't', page_variant: null })
})

test('a creator page that fails to render still sends the visitor to /app for the creator', async ({ page }) => {
    await page.goto('/go/carol/ig?utm_campaign=t')
    await appEntryDone(page)
    const app = new URL(page.url())
    expect(Object.fromEntries(app.searchParams)).toMatchObject({
        tl: 'carol',
        acq_invite: 'carol',
        tl_s: 'ig',
        utm_campaign: 't',
        tl_v: 'e2e-broken',
    })
})
