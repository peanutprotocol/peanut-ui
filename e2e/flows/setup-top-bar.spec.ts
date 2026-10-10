/**
 * Sign-up top bar — the language switcher and the back button stay put while
 * the steps slide (TASK-23467, Hugo's staging QA).
 *
 * The switcher used to live inside each step's hero, so it slid out with the
 * old step and in with the new one while the back button stayed fixed. The
 * test samples both controls on every animation frame of each transition and
 * requires exactly one switcher, at one position, the whole time.
 *
 *   NEXT_PUBLIC_VERCEL_ENV=preview npm run build
 *   npm run test:e2e:regression -- setup-top-bar
 */

import { expect, test, type Page } from '@playwright/test'

type Box = { x: number; y: number }
type Sample = { switchers: Box[]; back: Box | null }

/** Samples the switcher(s) and the back button on every frame for `ms`. */
async function sampleDuring(page: Page, ms: number, act: () => Promise<void>): Promise<Sample[]> {
    await page.evaluate((duration) => {
        const w = window as unknown as { __topBarSamples: Sample[] }
        w.__topBarSamples = []
        const box = (el: Element) => {
            const r = el.getBoundingClientRect()
            return { x: Math.round(r.x), y: Math.round(r.y) }
        }
        const end = performance.now() + duration
        const tick = () => {
            const switchers = Array.from(document.querySelectorAll('button')).filter(
                (button) => /^EN\b/.test(button.textContent?.trim() ?? '') && button.getBoundingClientRect().width > 0
            )
            const back = document.querySelector('[aria-label="Go back"]')
            w.__topBarSamples.push({ switchers: switchers.map(box), back: back ? box(back) : null })
            if (performance.now() < end) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
    }, ms)
    await act()
    await page.waitForTimeout(ms + 100)
    return page.evaluate(() => (window as unknown as { __topBarSamples: Sample[] }).__topBarSamples)
}

test('the language switcher and the back button do not move between sign-up steps', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    // Headless Chromium has no platform authenticator; the setup gate would show the unsupported modal.
    await page.addInitScript(() => {
        const w = window as unknown as {
            PublicKeyCredential: { isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean> }
        }
        w.PublicKeyCredential = w.PublicKeyCredential || (function () {} as never)
        w.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async () => true
    })
    await page.route('**/*', (route) =>
        ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort()
    )
    await page.goto('/setup')
    const signUp = page.getByRole('button', { name: 'Sign up' })
    await expect(signUp).toBeVisible({ timeout: 60_000 })
    await page.waitForTimeout(1500)

    const toInvite = await sampleDuring(page, 900, () => signUp.click())
    await expect(page).toHaveURL(/screen=invite/)
    const toUsername = await sampleDuring(page, 900, () => page.getByRole('button', { name: 'Skip' }).click())
    await expect(page).toHaveURL(/screen=signup/)
    const backToInvite = await sampleDuring(page, 900, () => page.getByRole('button', { name: 'Go back' }).click())
    await expect(page).toHaveURL(/screen=invite/)

    const samples = [...toInvite, ...toUsername, ...backToInvite]
    expect(samples.length).toBeGreaterThan(30)
    // One switcher on every frame, always at the same place.
    expect(samples.every((s) => s.switchers.length === 1)).toBe(true)
    const switcherAt = new Set(samples.map((s) => JSON.stringify(s.switchers[0])))
    expect([...switcherAt]).toHaveLength(1)
    // The back button, wherever it shows, is always at the same place too.
    const backAt = new Set(samples.filter((s) => s.back).map((s) => JSON.stringify(s.back)))
    expect([...backAt]).toHaveLength(1)
})
