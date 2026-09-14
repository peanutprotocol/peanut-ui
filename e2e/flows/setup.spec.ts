/**
 * Logged-out /setup with a stale auth cookie (TASK-21050).
 *
 * A structurally valid but long-expired JWT is the "cookie present, session
 * dead" state a half-finished signup leaves behind. The old presence-only
 * proxy check 307'd /setup → /home on it, and the logged-out /home → /setup
 * redirect in (mobile-ui)/layout.tsx sent it back: the PWA reload loop.
 *
 * No API and no auth. The fixture shots cover how /setup looks; this covers
 * where it sends you.
 */

import { test, expect } from '@playwright/test'

test('stale jwt-token cookie must not bounce /setup to /home', async ({ page, baseURL }) => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const staleJwt = [
        b64({ alg: 'HS256', typ: 'JWT' }),
        b64({ userId: '00000000-0000-0000-0000-000000000000', exp: 1 }),
        'stale-signature',
    ].join('.')
    await page
        .context()
        .addCookies([{ name: 'jwt-token', value: staleJwt, domain: new URL(baseURL!).hostname, path: '/' }])

    // The regression assertion, at the document layer: the old middleware 307'd
    // this exact request. A post-hydration URL check is vacuous here — a 401 from
    // /users/me clears the cookie, and the loop's own client leg can land back on
    // /setup before the URL is read. maxRedirects: 0 sees the raw status, and the
    // request fixture shares the context cookie jar, so the stale cookie is sent.
    const res = await page.context().request.get('/setup', { maxRedirects: 0 })
    expect(res.status()).toBe(200)

    // Browser-side check: stub the auth call to a fixed 401, so the forged token
    // never reaches a real API, then confirm the page stays on /setup and renders.
    await page.route('**/users/me', (route) =>
        route.fulfill({ status: 401, headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' })
    )
    await page.goto('/setup', { waitUntil: 'domcontentloaded' })
    expect(new URL(page.url()).pathname).toBe('/setup')

    const hasCrash = await page
        .locator('text=/Application error/i')
        .isVisible({ timeout: 1_000 })
        .catch(() => false)
    expect(hasCrash).toBe(false)
    expect(new URL(page.url()).pathname).toBe('/setup')
})
