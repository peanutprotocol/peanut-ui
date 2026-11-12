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

async function openSetupSurface(page: Page, id: string) {
    await page.goto(`/dev/surfaces?s=${id}&__fixture=${SETUP_FIXTURE}`, { waitUntil: 'domcontentloaded' })
    await expect(page, id).toHaveURL(new RegExp(`/dev/surfaces\\?s=${id}`))
    await expect
        .poll(() => page.evaluate((key) => sessionStorage.getItem(key), FIXTURE_STORAGE_KEY), {
            message: `${id}: setup fixture engaged`,
        })
        .toBe(SETUP_FIXTURE)
}

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
// The board's hero is 40% of the viewport. 320x568 is the one documented exception (34%, globals.css).
const boardHero = ({ width, height }: { width: number; height: number }) =>
    height * (width < 360 && height < 600 ? 0.34 : 0.4)

for (const viewport of VIEWPORTS) {
    test(`the hero, the language switcher and the back button stay put between steps at ${viewport.width}x${viewport.height}`, async ({
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

        const toUsername = await sampleDuring(page, 900, () => signUp.click())
        await expect(page).toHaveURL(/screen=signup/)
        const backToLanding = await sampleDuring(page, 900, () => page.getByRole('button', { name: 'Go back' }).click())
        await expect(page).toHaveURL(/screen=landing|\/setup$/)
        const toUsernameAgain = await sampleDuring(page, 900, () => signUp.click())
        await expect(page).toHaveURL(/screen=signup/)

        const samples = [...toUsername, ...backToLanding, ...toUsernameAgain]
        expect(samples.length).toBeGreaterThan(30)
        // One hero on every frame, with one box: it neither slides nor changes height.
        expect(samples.every((s) => s.heroes.length === 1)).toBe(true)
        expect(new Set(samples.map((s) => s.heroes[0])).size).toBe(1)
        // The hero keeps the board's proportion (within 5%).
        const heroHeight = Number(samples[0].heroes[0].split(',')[3])
        expect(Math.abs(heroHeight - boardHero(viewport))).toBeLessThanOrEqual(boardHero(viewport) * 0.05)
        // One switcher on every frame, always at the same place.
        expect(samples.every((s) => s.switchers.length === 1)).toBe(true)
        expect(new Set(samples.map((s) => JSON.stringify(s.switchers[0]))).size).toBe(1)
        // The back button, wherever it shows, is always at the same place too.
        expect(new Set(samples.filter((s) => s.back).map((s) => JSON.stringify(s.back))).size).toBe(1)
    })
}

test('the default web landing offers app download without the signup footer', async ({ page }) => {
    await prepareSetupSurface(page)
    await openSetupSurface(page, '01-a-landing')
    await expect(page.getByRole('button', { name: 'Google Play', exact: true })).toBeVisible()
    await expect(page.locator('[data-setup-footer]')).toHaveCount(0)
})

test('the fullscreen residence comparison paints its safe area and positions the top bar once', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    await prepareSetupSurface(page)
    await openSetupSurface(page, '03-b-residence-compare')
    const hero = page.locator('[data-setup-hero]')
    await expect(page.getByTestId('setup-residence-select-PT')).toBeVisible()
    await expect(hero).toHaveCount(0)
    await page.evaluate(() => document.documentElement.style.setProperty('--safe-area-inset-top', '59px'))

    const shell = page.locator('#scrollable-content')
    const strip = shell.locator('xpath=preceding-sibling::*[1]')
    await expect(strip).toHaveCSS('height', '59px')
    await expect(strip).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    expect(await shell.evaluate((node) => node.getBoundingClientRect().top)).toBe(59)
    const topBar = page.locator('[data-setup-top-bar]')
    await expect(topBar).toHaveCount(1)
    expect(await topBar.evaluate((node) => node.getBoundingClientRect().top)).toBe(75)

    await openSetupSurface(page, '84-f-choice-public-profile-guest')
    await expect(shell.getByText('Create your wallet')).toBeVisible()
    await page.evaluate(() => document.documentElement.style.setProperty('--safe-area-inset-top', '59px'))
    await expect(strip).toHaveCSS('height', '59px')
    await expect(strip).toHaveCSS('background-color', 'rgb(250, 244, 240)')
    await expect(shell).toHaveCSS('position', 'relative')
})

// Every sign-up step, as /setup renders it (the surfaces gallery mounts each step in the real wrapper).
const STEP_SURFACES = [
    '01-a-landing',
    '06-b-invite',
    '06-a-signup',
    '03-a-residence-select',
    '04-b-advantage-fees',
    '02-b-advantage-card',
    '03-c-residence-congrats',
    '07-c-notification-email',
    '07-d-notification-settings',
    '05-a-signtesttransaction',
]

for (const viewport of VIEWPORTS) {
    test(`every step keeps the board's hero and a reachable primary at ${viewport.width}x${viewport.height}`, async ({
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
        const heroes = new Set<number>()
        for (const id of STEP_SURFACES) {
            await openSetupSurface(page, id)
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
                    hero: Math.round(document.querySelector('[data-setup-hero]')!.getBoundingClientRect().height),
                    hit: !!hit && (hit === button || button.contains(hit)),
                    scrolls: document.scrollingElement!.scrollHeight > innerHeight,
                }
            })
            expect(layout.hit, `${id}: a tap at the primary's centre lands on it`).toBe(true)
            expect(layout.scrolls, `${id}: the page does not scroll`).toBe(false)
            heroes.add(layout.hero)
        }
        expect([...heroes]).toHaveLength(1)
        const [hero] = [...heroes]
        expect(Math.abs(hero - boardHero(viewport))).toBeLessThanOrEqual(boardHero(viewport) * 0.05)
    })
}

for (const viewport of VIEWPORTS) {
    for (const variant of ['switches', 'defaults-on']) {
        test(`notification ${variant} keeps both actions reachable at ${viewport.width}x${viewport.height}`, async ({
            page,
        }) => {
            await page.setViewportSize(viewport)
            await prepareSetupSurface(page)
            await openSetupSurface(page, `07-d-notification-${variant}`)
            const choices = page.getByTestId('setup-notification-choices')
            await expect(choices.getByRole('switch')).toHaveCount(3)
            const footer = page.locator('[data-setup-footer]')
            const next = footer.getByRole('button', { name: 'Continue', exact: true })
            const skip = footer.getByRole('button', { name: 'Not now', exact: true })
            await expect(next).toBeInViewport({ ratio: 1 })
            await expect(skip).toBeInViewport({ ratio: 1 })
            if (variant === 'switches') {
                await expect(next).toBeDisabled()
                await choices.getByRole('switch', { name: 'Important alerts' }).click()
            }
            for (const action of [next, skip]) {
                await expect(action).toBeEnabled()
                await expect(action).toBeInViewport({ ratio: 1 })
                expect(
                    await action.evaluate((button) => {
                        const r = button.getBoundingClientRect()
                        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
                        return hit === button || (!!hit && button.contains(hit))
                    })
                ).toBe(true)
            }
            if (viewport.width === 320) {
                const top = await next.evaluate((button) => button.getBoundingClientRect().top)
                const email = choices.getByRole('switch', { name: 'Email updates' })
                await email.scrollIntoViewIfNeeded()
                expect(await choices.evaluate((panel) => panel.scrollTop)).toBeGreaterThan(0)
                const checked = await email.getAttribute('aria-checked')
                await email.click()
                await expect(email).toHaveAttribute('aria-checked', checked === 'true' ? 'false' : 'true')
                expect(await next.evaluate((button) => button.getBoundingClientRect().top)).toBe(top)
            }
            expect(await page.evaluate(() => document.scrollingElement!.scrollHeight > innerHeight)).toBe(false)
        })
    }
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
