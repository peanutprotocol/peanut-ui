/**
 * Sign-up chrome in the redesigned shell (TASK-25016; first written for TASK-23467): the top bar (back, progress
 * dots, language) and the fixed footer stay put while the steps change, and every step's primary is reachable.
 *
 * On phones the old board hero (40 % of the viewport) is gone: each screen draws its own stage (`[data-setup-stage]`)
 * under one top bar, and the primary's top is the same on every screen (`--sr-cta-top`, mock 698 on 390 x 844 with
 * the phone's safe area). Desktop keeps dev's full-height side hero (`[data-setup-hero]`) beside the shell column. These checks follow the shell
 * (src/components/Setup/redesign/shell) and mono _temp/signup-redesign/r2/r9/build/INTERFACES.md § 3.
 *
 *   NEXT_PUBLIC_VERCEL_ENV=preview npm run build
 *   npm run test:e2e:regression -- setup-top-bar
 */

import { expect, test, type Locator, type Page } from '@playwright/test'
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
type Sample = { switchers: Box[]; back: Box | null; bars: string[]; cta: Box | null; stack: string | null }

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
            const footer = document.querySelector('[data-setup-footer]')
            const cta = footer?.querySelector('button')
            w.__topBarSamples.push({
                switchers: switchers.map(box),
                back: back ? box(back) : null,
                bars,
                cta: cta ? box(cta) : null,
                stack: footer?.getAttribute('data-stack') ?? null,
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
type Viewport = { width: number; height: number }
// The small phone: the `signup-sm` query (globals.css `.signup-shell`).
const smallPhone = ({ width, height }: Viewport) => height <= 600 || width <= 340
// The shell's CTA top: 112 px above the bottom, 100 px on the small phone.
const ctaTop = (viewport: Viewport) => viewport.height - (smallPhone(viewport) ? 100 : 112)
// The footer's lift by `data-stack` (globals.css --sr-lift-2/3): only a small phone lifts, by 20 px, 44 px with a link
// line under two buttons. Everywhere else the primary sits exactly at the CTA top.
const lift = (viewport: Viewport, stack: string | null) =>
    !smallPhone(viewport) || stack === '1' ? 0 : stack === '3' ? 44 : 20

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
        // The primary's top never moves: only its label crossfades. On a small phone the landing's two-button stack
        // sits 20 px higher, and the footer glides between the two over the step; each settled frame is exact.
        const withCta = samples.filter((s) => s.cta)
        if (!smallPhone(viewport)) {
            expect(new Set(withCta.map((s) => s.cta!.y)).size).toBe(1)
            expect(withCta[0].cta!.y).toBe(ctaTop(viewport))
        } else {
            for (const run of [toFirstStep, backToLanding, toFirstStepAgain]) {
                for (const settled of [run[0], run[run.length - 1]].filter((s) => s.cta)) {
                    expect(settled.cta!.y).toBe(ctaTop(viewport) - lift(viewport, settled.stack))
                }
            }
            for (const s of withCta) {
                expect(s.cta!.y).toBeGreaterThanOrEqual(ctaTop(viewport) - 20)
                expect(s.cta!.y).toBeLessThanOrEqual(ctaTop(viewport))
            }
        }
    })
}

test('the default web landing offers app download without the signup footer', async ({ page }) => {
    await prepareSetupSurface(page)
    await openSetupSurface(page, '01-a-landing')
    await expect(page.getByRole('button', { name: 'Google Play', exact: true })).toBeVisible()
    await expect(page.locator('[data-setup-footer]')).toHaveCount(0)
})

/** A colour token as the browser computes it, e.g. the pink ground (`--color-background-brand`). */
async function tokenColor(page: Page, token: string) {
    return page.evaluate((name) => {
        const probe = document.createElement('div')
        probe.style.backgroundColor = `var(${name})`
        document.body.append(probe)
        const color = getComputedStyle(probe).backgroundColor
        probe.remove()
        return color
    }, token)
}

/**
 * A box once it has stopped moving: the footer glides 500 ms to a new lift (a note that needs room, large text), so
 * a box read during the glide is neither where it was nor where it rests.
 */
async function restingBox(locator: Locator) {
    let last = ''
    await expect
        .poll(
            async () => {
                const box = JSON.stringify(await locator.boundingBox())
                const resting = box === last
                last = box
                return resting
            },
            { intervals: [250] }
        )
        .toBe(true)
    return JSON.parse(last) as Awaited<ReturnType<Locator['boundingBox']>>
}

test('the residence comparison paints both safe areas and positions the top bar once', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    await prepareSetupSurface(page)
    // 07 with two different countries; Continue opens the comparison on the same step, as on /setup
    await openSetupSurface(page, 'setup-redesign-residence-differ', 'setup-redesign-residence-compare')
    await page.locator('[data-setup-footer]').getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByTestId('setup-residence-select-PT')).toBeVisible()
    await expect(page.getByTestId('setup-redesign-residence-column-BR')).toBeVisible()
    await page.evaluate(() => {
        document.documentElement.style.setProperty('--safe-area-inset-top', '59px')
        document.documentElement.style.setProperty('--safe-area-inset-bottom', '34px')
    })

    // the status-bar strip takes the screen's ground (07 Residence: pink)
    const shell = page.locator('#scrollable-content')
    const strip = shell.locator('xpath=preceding-sibling::*[1]')
    await expect(strip).toHaveCSS('height', '59px')
    await expect(strip).toHaveCSS('background-color', await tokenColor(page, '--color-background-brand'))
    expect(await shell.evaluate((node) => node.getBoundingClientRect().top)).toBe(59)
    // the top bar sits 4 px under the safe area (--sr-topbar-top)
    const topBar = page.locator('[data-setup-top-bar]')
    await expect(topBar).toHaveCount(1)
    expect(await topBar.evaluate((node) => node.getBoundingClientRect().top)).toBe(63)
    // the home-bar strip continues the white panel (V1)
    const inset = page.locator('[data-setup-inset]')
    await expect(inset).toHaveCSS('height', '34px')
    await expect(inset).toHaveCSS('background-color', 'rgb(255, 255, 255)')

    await openSetupSurface(page, '84-f-choice-public-profile-guest')
    await expect(shell.getByText('Create your wallet')).toBeVisible()
    await page.evaluate(() => document.documentElement.style.setProperty('--safe-area-inset-top', '59px'))
    await expect(strip).toHaveCSS('height', '59px')
    await expect(strip).toHaveCSS('background-color', 'rgb(250, 244, 240)')
    await expect(shell).toHaveCSS('position', 'relative')
})

test('the celebration paints the home-bar strip with its ground', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    await prepareSetupSurface(page)
    await openSetupSurface(page, '07-e-setup-celebration')
    // 12 is a full stage: no panel, so the strip under it continues the ground (V1); with Verify now and Remind me
    // later it stays until a tap
    await expect(page.locator('[data-setup-stage][data-ground="pink"]')).toBeVisible()
    await page.evaluate(() => document.documentElement.style.setProperty('--safe-area-inset-bottom', '34px'))
    const inset = page.locator('[data-setup-inset]')
    await expect(inset).toHaveCSS('height', '34px')
    await expect(inset).toHaveCSS('background-color', await tokenColor(page, '--color-background-brand'))
})

// Every sign-up step in dev's order (01 Landing … 11 Final), as /setup renders it: the `setup-redesign-*` surfaces
// mount the step's own Setup.consts entry in the real shell with the flow seeded, under its default fixture.
const STEP_SURFACES = [
    'landing',
    'accounts',
    'card',
    'residence',
    'plan',
    'username',
    'invite',
    'passkey',
    'email',
    'notifications',
    'final',
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
        for (const screen of STEP_SURFACES) {
            const id = `setup-redesign-${screen}`
            await openSetupSurface(page, id, `${id}-default`)
            const footer = page.locator('[data-setup-footer]')
            const primary =
                screen === 'landing'
                    ? footer.getByRole('button', { name: 'Sign up', exact: true })
                    : footer.getByRole('button').first()
            await expect(primary, `${id}: signup action`).toBeVisible()
            await expect(primary).toBeInViewport({ ratio: 1 })
            // a footer whose note needs room glides up 500 ms after the step mounts; the resting top is exact
            await restingBox(primary)
            const layout = await primary.evaluate((button) => {
                const r = button.getBoundingClientRect()
                const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
                return {
                    top: Math.round(r.top),
                    stack: button.closest('[data-setup-footer]')?.getAttribute('data-stack') ?? null,
                    hit: !!hit && (hit === button || button.contains(hit)),
                    scrolls: document.scrollingElement!.scrollHeight > innerHeight,
                }
            })
            expect(layout.hit, `${id}: a tap at the primary's centre lands on it`).toBe(true)
            expect(layout.scrolls, `${id}: the page does not scroll`).toBe(false)
            expect(layout.top, `${id}: the primary sits at the shell's CTA top (stack ${layout.stack})`).toBe(
                ctaTop(viewport) - lift(viewport, layout.stack)
            )
        }
    })
}

// Contract P4 § 3: the step draws "Turn on notifications" + "Not now" (no switch).
for (const viewport of VIEWPORTS) {
    test(`notification settings keeps every action reachable at ${viewport.width}x${viewport.height}`, async ({
        page,
    }) => {
        await page.setViewportSize(viewport)
        await prepareSetupSurface(page)
        await openSetupSurface(page, '07-d-notification-settings')
        await expect(page.getByRole('switch')).toHaveCount(0)
        const footer = page.locator('[data-setup-footer]')
        const next = footer.getByRole('button', { name: 'Turn on notifications', exact: true })
        const skip = footer.getByRole('button', { name: 'Not now', exact: true })
        for (const action of [next, skip]) {
            await action.scrollIntoViewIfNeeded()
            await expect(action).toBeEnabled()
            await expect(action).toBeInViewport({ ratio: 1 })
            await action.click({ trial: true })
        }
        expect(await page.evaluate(() => document.scrollingElement!.scrollHeight > innerHeight)).toBe(false)
    })
}

test('desktop keeps the full-height side hero, with the shell column beside it', async ({ page }) => {
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
    // dev's split: the hero takes 7/12 of the width at full height; the shell column fills the rest
    const heroBox = (await hero.boundingBox())!
    expect(Math.round(heroBox.height)).toBe(900)
    expect(Math.round(heroBox.x)).toBe(0)
    expect(Math.abs(heroBox.width - (1024 * 7) / 12)).toBeLessThanOrEqual(1)
    const shell = (await page.locator('[data-setup-shell]').boundingBox())!
    expect(Math.round(shell.height)).toBe(900)
    expect(Math.abs(shell.x - (heroBox.x + heroBox.width))).toBeLessThanOrEqual(1)
    expect(Math.abs(shell.x + shell.width - 1024)).toBeLessThanOrEqual(1)
})
