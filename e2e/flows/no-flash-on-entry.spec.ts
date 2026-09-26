/**
 * A tap lands on the screen it names, with no other screen on the way
 * (TASK-23054).
 *
 * Send → Crypto used to push /withdraw?method=crypto. That route rendered the
 * Withdraw method list for a few frames, then a mount effect replaced it with
 * /withdraw/crypto. A country whose one live rail is Manteca did the same: the
 * rail list showed, then forwarded to the Manteca flow. Each spec records every
 * painted frame from the tap until the page settles, so a screen that shows for
 * a single frame still fails.
 *
 * No API and no login: `?__fixture=home` fakes the session and every answer.
 */

import { test, expect, type Page } from '@playwright/test'

// The home fixture's balance trips the non-dismissible high-balance sheet,
// which covers the submenu. Mark it seen for whichever user the fixture uses.
async function suppressBalanceWarning(page: Page) {
    await page.addInitScript(() => {
        const getItem = Storage.prototype.getItem
        Storage.prototype.getItem = function (key: string) {
            const value = getItem.call(this, key)
            if (!key.endsWith(':user-preferences')) return value
            const prefs = value ? JSON.parse(value) : {}
            prefs.hasSeenBalanceWarning = { value: true, expiry: Date.now() + 86_400_000 }
            return JSON.stringify(prefs)
        }
    })
}

interface Frame {
    path: string
    texts: string[]
}

type FrameWindow = Window & { __frames: Frame[]; __stopFrames: () => void }

/**
 * Records, on every animation frame, the path and the visible leaf texts the
 * page shows. Only frames whose path starts with `pathPrefix` are kept, so the page
 * the tap starts from never counts.
 */
async function recordFrames(page: Page, pathPrefix: string) {
    await page.evaluate((prefix) => {
        const frames: Frame[] = []
        let running = true
        const tick = () => {
            if (!running) return
            if (location.pathname.startsWith(prefix)) {
                const texts: string[] = []
                for (const el of document.body.querySelectorAll('*')) {
                    if (el.childElementCount > 0 || !el.checkVisibility()) continue
                    const text = el.textContent?.trim()
                    if (text) texts.push(text)
                }
                frames.push({ path: location.pathname + location.search, texts })
            }
            requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
        const w = window as unknown as FrameWindow
        w.__frames = frames
        w.__stopFrames = () => {
            running = false
        }
    }, pathPrefix)
}

async function stopFrames(page: Page): Promise<Frame[]> {
    return page.evaluate(() => {
        const w = window as unknown as FrameWindow
        w.__stopFrames()
        return w.__frames
    })
}

/** Client-side navigation, the way an in-app link or the exchange-rate widget moves. */
async function clientPush(page: Page, href: string) {
    await page.evaluate((to) => {
        const next = (window as unknown as { next: { router: { push: (href: string) => void } } }).next
        next.router.push(to)
    }, href)
}

test.describe('no other screen on the way', () => {
    test.beforeEach(async ({ page }) => {
        await suppressBalanceWarning(page)
    })

    test('Send → Crypto opens the send-to-crypto screen without showing Withdraw', async ({ page }) => {
        await page.goto('/home?__fixture=home', { waitUntil: 'domcontentloaded' })
        await page.getByTestId('home-submenu-send').click({ timeout: 60_000 })
        await page.getByTestId('home-drawer-send-send-friends').click()
        await page.waitForURL(/\/send$/)

        const cryptoRow = page.getByText('Crypto', { exact: true })
        await expect(cryptoRow).toBeVisible()
        await recordFrames(page, '/withdraw')
        await cryptoRow.click()
        await page.waitForURL(/\/withdraw\/crypto\?method=crypto/)
        await expect(page.getByText('Wallet address')).toBeVisible()
        await page.waitForTimeout(500)

        const frames = await stopFrames(page)
        expect(frames.length).toBeGreaterThan(0)
        // the Withdraw root lives at /withdraw itself; Send never passes through it
        expect(frames.filter((f) => new URL(f.path, 'http://x').pathname === '/withdraw').map((f) => f.path)).toEqual(
            []
        )
        expect(frames.filter((f) => f.texts.includes('Withdraw')).map((f) => f.path)).toEqual([])

        // back returns to Send, and browser back from Send goes on to home
        await page.getByTestId('nav-back').first().click()
        await page.waitForURL(/\/send$/)
        await page.goBack()
        await page.waitForURL((url) => url.pathname === '/home')
    })

    test('an old crypto amount-step link forwards to /withdraw/crypto with nothing on the way', async ({ page }) => {
        await page.goto('/home?__fixture=home', { waitUntil: 'domcontentloaded' })
        await expect(page.getByTestId('home-submenu-send')).toBeVisible({ timeout: 60_000 })

        await recordFrames(page, '/withdraw')
        await clientPush(page, '/withdraw?step=amount&method=crypto&amount=5')
        await page.waitForURL(/\/withdraw\/crypto\?method=crypto&amount=5/)
        await expect(page.getByText('Wallet address')).toBeVisible()
        await page.waitForTimeout(500)

        const frames = await stopFrames(page)
        const onRoot = frames.filter((f) => new URL(f.path, 'http://x').pathname === '/withdraw')
        // the forward may take a frame, but that frame shows neither Withdraw nor its amount step
        expect(
            onRoot.filter((f) => f.texts.includes('Withdraw') || f.texts.includes('Amount to send')).map((f) => f.path)
        ).toEqual([])
        expect(frames.filter((f) => f.texts.includes('Withdraw')).map((f) => f.path)).toEqual([])
    })

    test('a Manteca-only country opens its flow without showing the rail list', async ({ page }) => {
        await page.goto('/home?__fixture=home', { waitUntil: 'domcontentloaded' })
        await expect(page.getByTestId('home-submenu-send')).toBeVisible({ timeout: 60_000 })

        await recordFrames(page, '/withdraw')
        await clientPush(page, '/withdraw/brazil')
        await page.waitForURL(/\/withdraw\/manteca\?method=pix&country=brazil/)
        await page.waitForTimeout(500)

        const frames = await stopFrames(page)
        const onCountry = frames.filter((f) => f.path.startsWith('/withdraw/brazil'))
        // the rail list's title is the country name
        expect(onCountry.filter((f) => f.texts.includes('Brazil')).map((f) => f.path)).toEqual([])
    })
})
