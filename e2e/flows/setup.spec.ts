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

        // No API mocks on purpose: the real API 401s the stale token (the production
        // condition), while the mock catch-all's `200 {}` would fake a logged-in user
        // and trip InstallPWA's own client-side push to /home.
        await page.goto('/setup', { waitUntil: 'domcontentloaded' })
        await captureStep(page, testInfo, { name: '01-setup-with-stale-cookie' })
        expect(new URL(page.url()).pathname).toBe('/setup')

        // Outlast the 3s hard-nav fallback in (mobile-ui)/layout.tsx — the pump that
        // turned a single bounce into an infinite reload loop in the installed PWA.
        await page.waitForTimeout(4000)
        expect(new URL(page.url()).pathname).toBe('/setup')

        consoleLogs.flush(testInfo, 'setup-stale-cookie')
    })
})
