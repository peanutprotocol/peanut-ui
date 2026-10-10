/**
 * Sign-up top — the hero, the language switcher and the back button stay put
 * while the steps change (TASK-23467, Hugo's staging QA).
 *
 * The hero (with the switcher) used to slide with each step and change height
 * per step. Now only the white panel slides; the hero keeps one height per
 * viewport and crossfades its art. The test samples the hero, the switcher and
 * the back button on every animation frame of each transition, at each phone
 * size we support, and requires one hero box, one switcher position and one
 * back position the whole time.
 *
 *   NEXT_PUBLIC_VERCEL_ENV=preview npm run build
 *   npm run test:e2e:regression -- setup-top-bar
 */

import { expect, test, type Page } from '@playwright/test'

type Box = { x: number; y: number }
type Sample = { switchers: Box[]; back: Box | null; heroes: string[] }

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
            const heroes = Array.from(document.querySelectorAll('[data-setup-hero]')).map((el) => {
                const r = el.getBoundingClientRect()
                return [r.x, r.y, r.width, r.height].map(Math.round).join(',')
            })
            w.__topBarSamples.push({ switchers: switchers.map(box), back: back ? box(back) : null, heroes })
            if (performance.now() < end) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
    }, ms)
    await act()
    await page.waitForTimeout(ms + 100)
    return page.evaluate(() => (window as unknown as { __topBarSamples: Sample[] }).__topBarSamples)
}

const VIEWPORTS = [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 360, height: 740 },
    { width: 390, height: 844 },
    { width: 375, height: 600 },
]

for (const viewport of VIEWPORTS) {
    test(`the hero, the language switcher and the back button stay put between steps at ${viewport.width}x${viewport.height}`, async ({
        page,
    }) => {
        await page.setViewportSize(viewport)
        // Headless Chromium has no platform authenticator; the setup gate would show the unsupported modal.
        await page.addInitScript(() => {
            const w = window as unknown as {
                PublicKeyCredential: { isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean> }
            }
            w.PublicKeyCredential = w.PublicKeyCredential || (function () {} as never)
            w.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async () => true
        })
        await page.route('**/*', (route) =>
            ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)
                ? route.continue()
                : route.abort()
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
        // One hero on every frame, with one box: it neither slides nor changes height.
        expect(samples.every((s) => s.heroes.length === 1)).toBe(true)
        expect(new Set(samples.map((s) => s.heroes[0])).size).toBe(1)
        // One switcher on every frame, always at the same place.
        expect(samples.every((s) => s.switchers.length === 1)).toBe(true)
        expect(new Set(samples.map((s) => JSON.stringify(s.switchers[0]))).size).toBe(1)
        // The back button, wherever it shows, is always at the same place too.
        expect(new Set(samples.filter((s) => s.back).map((s) => JSON.stringify(s.back))).size).toBe(1)
    })
}

test('desktop keeps the full-height side hero', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.addInitScript(() => {
        const w = window as unknown as {
            PublicKeyCredential: { isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean> }
        }
        w.PublicKeyCredential = w.PublicKeyCredential || (function () {} as never)
        w.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async () => true
    })
    await page.goto('/setup')
    const hero = page.locator('[data-setup-hero]')
    await expect(hero).toBeVisible({ timeout: 60_000 })
    await page.waitForTimeout(1500)
    expect(Math.round((await hero.boundingBox())!.height)).toBe(900)
})
