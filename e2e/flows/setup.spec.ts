/**
 * Setup / onboarding flow.
 *
 * Exercises:
 *   - Redux setup slice (being killed → nuqs migration)
 *   - Multi-step flow state
 *   - PWA install prompt
 *   - KYC onboarding entry point
 *
 * Captures each visible step. Passkey creation is skipped (handled by auth bypass).
 * API mocks installed to prevent error states from prod API rejection.
 */

import { test, expect } from '@playwright/test'
import { captureStep, collectConsoleLogs } from '../utils/capture'
import { installApiMocks } from '../utils/mock-api'

test.describe('Setup flow', () => {
    test('setup page — shows onboarding steps', async ({ page }, testInfo) => {
        const consoleLogs = collectConsoleLogs(page)
        await installApiMocks(page)

        await page.goto('/setup')
        await captureStep(page, testInfo, { name: '01-setup-initial' })

        await page.waitForTimeout(2000)
        await captureStep(page, testInfo, { name: '02-setup-loaded' })

        consoleLogs.flush(testInfo, 'setup')
    })

    test('profile page', async ({ page }, testInfo) => {
        const consoleLogs = collectConsoleLogs(page)

        await page.goto('/profile')
        await captureStep(page, testInfo, { name: '01-profile-initial' })

        await page.waitForTimeout(2000)
        await captureStep(page, testInfo, { name: '02-profile-loaded' })

        consoleLogs.flush(testInfo, 'profile')
    })

    test('points page', async ({ page }, testInfo) => {
        const consoleLogs = collectConsoleLogs(page)
        await installApiMocks(page)

        // Navigate directly to /rewards — /points redirects via server component
        // which can trigger React hooks ordering bugs in dev mode
        await page.goto('/rewards')
        await captureStep(page, testInfo, { name: '01-points-initial' })

        await page.waitForTimeout(3000)
        await captureStep(page, testInfo, { name: '02-points-loaded' })

        // KNOWN BUG: /rewards page crashes with "Rendered more hooks than
        // during the previous render" — a React hooks ordering violation.
        // This is a real app bug, not a test/mock issue.
        const hasCrash = await page
            .locator('text=/Application error/i')
            .isVisible({ timeout: 2000 })
            .catch(() => false)

        if (hasCrash) {
            testInfo.annotations.push({
                type: 'known-bug',
                description:
                    'Rewards page: "Rendered more hooks than during the previous render" — React hooks ordering violation',
            })
        }

        consoleLogs.flush(testInfo, 'points')
    })

    test('history page', async ({ page }, testInfo) => {
        const consoleLogs = collectConsoleLogs(page)
        await installApiMocks(page)

        await page.goto('/history')
        await captureStep(page, testInfo, { name: '01-history-initial' })

        await page.waitForTimeout(2000)
        await captureStep(page, testInfo, { name: '02-history-loaded' })

        // With mocks, should NOT show error
        const hasError = await page
            .locator('text=/Error loading/i')
            .isVisible({ timeout: 2000 })
            .catch(() => false)
        expect(hasError).toBe(false)

        consoleLogs.flush(testInfo, 'history')
    })
})

test.describe('logged-out /setup with stale auth cookie (TASK-21050)', () => {
    // Clean context — the shared storageState is pre-authenticated, and this
    // regression is specifically about a cookie that does NOT authenticate.
    test.use({ storageState: { cookies: [], origins: [] } })

    test('stale jwt-token cookie must not bounce /setup to /home', async ({ page, baseURL }, testInfo) => {
        const consoleLogs = collectConsoleLogs(page)

        // Structurally valid but long-expired JWT — the "cookie present, session dead"
        // state a half-completed signup or expired session leaves behind. The old
        // presence-only proxy check 307'd /setup → /home on it, fighting the logged-out
        // /home → /setup redirect in (mobile-ui)/layout.tsx: the PWA reload loop.
        const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
        const staleJwt = [
            b64({ alg: 'HS256', typ: 'JWT' }),
            b64({ userId: '00000000-0000-0000-0000-000000000000', exp: 1 }),
            'stale-signature',
        ].join('.')
        await page
            .context()
            .addCookies([{ name: 'jwt-token', value: staleJwt, domain: new URL(baseURL!).hostname, path: '/' }])

        // THE regression assertion, at the document layer: the old middleware 307'd
        // this exact request. Post-hydration URL checks are vacuous here — a 401 from
        // /users/me clears the cookie and the loop's own client leg can land back on
        // /setup before the URL is read. maxRedirects: 0 sees the raw status; the
        // request fixture shares the context cookie jar, so the stale cookie is sent.
        const res = await page.context().request.get('/setup', { maxRedirects: 0 })
        expect(res.status()).toBe(200)

        // Browser-side smoke: stub the auth check to a deterministic 401 (keeps the
        // forged token off any real API) and confirm the page loads, stays on /setup,
        // and renders — no client-side redirect or crash for the stale-cookie visitor.
        await page.route('**/users/me', (route) =>
            route.fulfill({ status: 401, headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' })
        )
        await page.goto('/setup', { waitUntil: 'domcontentloaded' })
        expect(new URL(page.url()).pathname).toBe('/setup')
        await captureStep(page, testInfo, { name: '01-setup-with-stale-cookie' })
        expect(new URL(page.url()).pathname).toBe('/setup')
        const hasCrash = await page
            .locator('text=/Application error/i')
            .isVisible({ timeout: 1000 })
            .catch(() => false)
        expect(hasCrash).toBe(false)

        consoleLogs.flush(testInfo, 'setup-stale-cookie')
    })
})
