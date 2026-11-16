/**
 * Sign-up chrome in the redesigned shell (TASK-25016; first written for TASK-23467): the top bar (back, progress
 * dots, language) and the fixed footer stay put while the steps change, and every step's primary is reachable.
 *
 * The old board hero (`[data-setup-hero]`, 40 % of the viewport, a side hero on desktop) is gone: each screen now
 * draws its own stage (`[data-setup-stage]`) under one top bar, and the primary's top is the same on every screen
 * (`--sr-cta-top`, mock 698 on 390 x 844 with the phone's safe area). These checks follow the shell
 * (src/components/Setup/redesign/shell) and mono _temp/signup-redesign/r2/r9/build/INTERFACES.md § 3.
 *
 *   NEXT_PUBLIC_VERCEL_ENV=preview npm run build
 *   npm run test:e2e:regression -- setup-top-bar
 */

import { expect, test, type Page } from '@playwright/test'
import { KEEP_WEB_COOKIE, KEEP_WEB_TOKEN } from '../../src/constants/migration.consts'
import { FIXTURE_STORAGE_KEY } from '../../src/dev/fixtures/active'
import { blockExternal, seenOnceModals } from '../shots/fixture-page'

const SETUP_FIXTURE = 'profile-edit'

async function enableWebSignup(page: Page, baseURL: string) {
    await page.context().addCookies([
        {
            name: KEEP_WEB_COOKIE,
            value: encodeURIComponent(JSON.stringify(KEEP_WEB_TOKEN)),
            url: baseURL,
        },
    ])
}

async function prepareSetupSurface(page: Page) {
    await blockExternal(page, SETUP_FIXTURE)
    await page.addInitScript(seenOnceModals)
    await page.addInitScript(() => {
        ;(window as Window & { __screenCapture?: boolean }).__screenCapture = true
    })
}

async function openSetupSurface(page: Page, id: string, fixture = SETUP_FIXTURE) {
    await page.goto(`/dev/surfaces?s=${id}&__fixture=${fixture}`, { waitUntil: 'domcontentloaded' })
    await expect(page, id).toHaveURL(new RegExp(`/dev/surfaces\\?s=${id}`))
    await expect
        .poll(() => page.evaluate((key) => sessionStorage.getItem(key), FIXTURE_STORAGE_KEY), {
            message: `${id}: setup fixture engaged`,
        })
        .toBe(fixture)
}

type Box = { x: number; y: number }
type Sample = { switchers: Box[]; back: Box | null; bars: string[]; cta: Box | null }

/** Samples the top bar, the language switcher, the back button and the footer on every frame for `ms`. */
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
            const switchers = Array.from(document.querySelectorAll('[data-setup-top-bar] button')).filter(
                (button) => /^EN\b/.test(button.textContent?.trim() ?? '') && button.getBoundingClientRect().width > 0
            )
            const back = document.querySelector('[data-setup-top-bar] [aria-label="Go back"]')
            const bars = Array.from(document.querySelectorAll('[data-setup-top-bar]')).map((el) => {
                const r = el.getBoundingClientRect()
                return [r.x, r.y, r.width, r.height].map(Math.round).join(',')
            })
            const cta = document.querySelector('[data-setup-footer] button')
            w.__topBarSamples.push({
                switchers: switchers.map(box),
                back: back ? box(back) : null,
                bars,
                cta: cta ? box(cta) : null,
            })
            if (performance.now() < end) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
    }, ms)
    await act()
    await page.waitForTimeout(ms + 100)
    return page.evaluate(() => (window as unknown as { __topBarSamples: Sample[] }).__topBarSamples)
}

// Real phone viewports once the browser bars take their share (Safari/Chrome), plus full-height ones.
const VIEWPORTS = [
    { width: 320, height: 568 },
    { width: 360, height: 640 },
    { width: 375, height: 553 },
    { width: 375, height: 667 },
    { width: 390, height: 664 },
    { width: 393, height: 659 },
    { width: 390, height: 844 },
    { width: 430, height: 739 },
]
// The shell's CTA top: 112 px above the bottom, 100 px on the small phone (the `signup-sm` query, globals.css).
const ctaTop = ({ width, height }: { width: number; height: number }) =>
    height - (height <= 600 || width <= 340 ? 100 : 112)

for (const viewport of VIEWPORTS) {
    test(`the top bar, the language switcher, the back button and the primary stay put between steps at ${viewport.width}x${viewport.height}`, async ({
        page,
        baseURL,
    }) => {
        await page.setViewportSize(viewport)
        await page.route('**/*', (route) =>
            ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)
                ? route.continue()
                : route.abort()
        )
        // web signup is app-only; the support keep-web cookie reopens it in this browser
        await enableWebSignup(page, baseURL!)
        await page.goto('/setup')
        const signUp = page.locator('[data-setup-footer]').getByRole('button', { name: 'Sign up', exact: true })
        await expect(signUp).toBeVisible({ timeout: 60_000 })
        await page.waitForTimeout(1500)

        const toFirstStep = await sampleDuring(page, 900, () => signUp.click())
        await expect(page).toHaveURL(/screen=advantage-fees/)
        const backToLanding = await sampleDuring(page, 900, () => page.getByRole('button', { name: 'Go back' }).click())
        await expect(page).toHaveURL(/screen=landing|\/setup$/)
        const toFirstStepAgain = await sampleDuring(page, 900, () => signUp.click())
        await expect(page).toHaveURL(/screen=advantage-fees/)

        const samples = [...toFirstStep, ...backToLanding, ...toFirstStepAgain]
        expect(samples.length).toBeGreaterThan(30)
        // One top bar on every frame, with one box: it never slides with the screens.
        expect(samples.every((s) => s.bars.length === 1)).toBe(true)
        expect(new Set(samples.map((s) => s.bars[0])).size).toBe(1)
        // One switcher on every frame, always at the same place.
        expect(samples.every((s) => s.switchers.length === 1)).toBe(true)
        expect(new Set(samples.map((s) => JSON.stringify(s.switchers[0]))).size).toBe(1)
        // The back button, wherever it shows, is always at the same place too.
        expect(new Set(samples.filter((s) => s.back).map((s) => JSON.stringify(s.back))).size).toBe(1)
        // The primary's top never moves: only its label crossfades (the landing's two-button stack may lift on a small phone).
        const ctaTops = new Set(samples.filter((s) => s.cta).map((s) => s.cta!.y))
        expect(ctaTops.size).toBeLessThanOrEqual(2)
    })
}

test('the default web landing offers app download without the signup footer', async ({ page }) => {
    await prepareSetupSurface(page)
    await openSetupSurface(page, '01-a-landing')
    await expect(page.getByRole('button', { name: 'Google Play', exact: true })).toBeVisible()
    await expect(page.locator('[data-setup-footer]')).toHaveCount(0)
})

test('the residence comparison keeps one top bar under the safe area and paints the safe area with its ground', async ({
    page,
}) => {
    await page.setViewportSize({ width: 393, height: 852 })
    await prepareSetupSurface(page)
    await openSetupSurface(page, '03-b-residence-compare')
    await expect(page.getByTestId('setup-residence-select-PT')).toBeVisible()
    await page.evaluate(() => document.documentElement.style.setProperty('--safe-area-inset-top', '59px'))

    const topBar = page.locator('[data-setup-top-bar]')
    await expect(topBar).toHaveCount(1)
    expect(await topBar.evaluate((node) => node.getBoundingClientRect().top)).toBeGreaterThanOrEqual(59)
    // the strip above the shell takes the screen's ground, not a white band
    const ground = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--setup-hero-background').trim()
    )
    expect(ground).not.toBe('')
})

// Every sign-up step, as /setup renders it (the surfaces gallery mounts each step in the real shell).
const STEP_SURFACES = [
    '01-a-landing',
    '04-b-advantage-fees',
    '02-b-advantage-card',
    '03-a-residence-select',
    '03-c-residence-congrats',
    '06-a-signup',
    '06-b-invite',
    '06-c-passkey',
    '07-c-notification-email',
    '07-d-notification-settings',
    '07-b-advantage-control',
    '05-a-signtesttransaction',
]

for (const viewport of VIEWPORTS) {
    test(`every step puts a reachable primary at the shell's CTA top at ${viewport.width}x${viewport.height}`, async ({
        page,
        baseURL,
    }) => {
        await page.setViewportSize(viewport)
        await enableWebSignup(page, baseURL!)
        await prepareSetupSurface(page)
        await page.addInitScript(() => {
            const w = window as unknown as {
                PublicKeyCredential: { isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean> }
            }
            w.PublicKeyCredential = w.PublicKeyCredential || (function () {} as never)
            w.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async () => true
        })
        for (const id of STEP_SURFACES) {
            await openSetupSurface(page, id, id === '06-c-passkey' ? 'setup-passkey' : SETUP_FIXTURE)
            const footer = page.locator('[data-setup-footer]')
            const primary =
                id === '01-a-landing'
                    ? footer.getByRole('button', { name: 'Sign up', exact: true })
                    : footer.getByRole('button').first()
            await expect(primary, `${id}: signup action`).toBeVisible()
            await expect(primary).toBeInViewport({ ratio: 1 })
            const layout = await primary.evaluate((button) => {
                const r = button.getBoundingClientRect()
                const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
                return {
                    top: Math.round(r.top),
                    hit: !!hit && (hit === button || button.contains(hit)),
                    scrolls: document.scrollingElement!.scrollHeight > innerHeight,
                }
            })
            expect(layout.hit, `${id}: a tap at the primary's centre lands on it`).toBe(true)
            expect(layout.scrolls, `${id}: the page does not scroll`).toBe(false)
            // a two-button stack lifts 20 px on a small phone (44 px with a link line under it)
            expect(
                ctaTop(viewport) - layout.top,
                `${id}: the primary sits at the shell's CTA top`
            ).toBeGreaterThanOrEqual(0)
            expect(ctaTop(viewport) - layout.top, `${id}: the primary sits at the shell's CTA top`).toBeLessThanOrEqual(
                44
            )
        }
    })
}

// Contract P4 § 3: the control arm draws "Turn on notifications" + "Not now" (no switch); the switch arms keep
// dev's three switch rows, Continue and Not now.
const NOTIFICATION_VARIANTS = ['settings', 'switches', 'defaults-on'] as const

for (const viewport of VIEWPORTS) {
    for (const variant of NOTIFICATION_VARIANTS) {
        test(`notification ${variant} keeps every choice and action reachable at ${viewport.width}x${viewport.height}`, async ({
            page,
        }) => {
            await page.setViewportSize(viewport)
            await prepareSetupSurface(page)
            await openSetupSurface(page, `07-d-notification-${variant}`)
            const control = variant === 'settings'
            const switches = page.getByRole('switch')
            await expect(switches).toHaveCount(control ? 0 : 3)
            const footer = page.locator('[data-setup-footer]')
            const next = footer.getByRole('button', {
                name: control ? 'Turn on notifications' : 'Continue',
                exact: true,
            })
            const skip = footer.getByRole('button', { name: 'Not now', exact: true })
            if (variant === 'switches') {
                await expect(next).toBeDisabled()
                await switches.first().click()
            }
            if (!control) {
                const email = page.getByRole('switch', { name: 'Email updates' })
                const checked = await email.getAttribute('aria-checked')
                await email.click()
                await expect(email).toHaveAttribute('aria-checked', checked === 'true' ? 'false' : 'true')
            }
            for (const action of [next, skip]) {
                await action.scrollIntoViewIfNeeded()
                await expect(action).toBeEnabled()
                await expect(action).toBeInViewport({ ratio: 1 })
                await action.click({ trial: true })
            }
            for (const toggle of await switches.all()) {
                await toggle.scrollIntoViewIfNeeded()
                await expect(toggle).toBeInViewport({ ratio: 1 })
                await toggle.click({ trial: true })
            }
            expect(await page.evaluate(() => document.scrollingElement!.scrollHeight > innerHeight)).toBe(false)
        })
    }
}

for (const variant of ['switches', 'defaults-on'] as const) {
    test(`notification ${variant} scrolls its choices inside the panel with large text, the top bar and footer stay`, async ({
        page,
    }) => {
        await page.setViewportSize({ width: 360, height: 480 })
        await prepareSetupSurface(page)
        await openSetupSurface(page, `07-d-notification-${variant}`)
        await page.addStyleTag({ content: 'html { font-size: 150% !important; }' })
        const topBar = page.locator('[data-setup-top-bar]')
        const footer = page.locator('[data-setup-footer]')
        const lastSwitch = page.getByRole('switch').last()
        const initialTopBar = await topBar.boundingBox()
        const initialFooter = await footer.boundingBox()

        await lastSwitch.scrollIntoViewIfNeeded()
        await expect(lastSwitch).toBeInViewport({ ratio: 1 })
        await lastSwitch.click({ trial: true })
        expect(await topBar.boundingBox()).toEqual(initialTopBar)
        expect(await footer.boundingBox()).toEqual(initialFooter)
        expect(await page.evaluate(() => window.scrollY)).toBe(0)
    })
}

test('desktop centres the phone-width shell at full height', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.addInitScript(() => {
        const w = window as unknown as {
            PublicKeyCredential: { isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean> }
        }
        w.PublicKeyCredential = w.PublicKeyCredential || (function () {} as never)
        w.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async () => true
    })
    await page.goto('/setup')
    const shell = page.locator('[data-setup-shell]')
    await expect(shell).toBeVisible({ timeout: 60_000 })
    await page.waitForTimeout(1500)
    const box = (await shell.boundingBox())!
    expect(Math.round(box.height)).toBe(900)
    expect(box.width).toBeLessThanOrEqual(480)
    expect(Math.abs(box.x + box.width / 2 - 512)).toBeLessThanOrEqual(1)
})
