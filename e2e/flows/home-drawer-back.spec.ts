/**
 * Home action drawers and Back (QA ledger H7: "home drawer flashes and does
 * not open after navigating back").
 *
 * The contract: choosing a drawer row clears `?drawer=` from home's history
 * entry before routing, so Back lands on home with the drawer closed and it
 * never appears on the way; the same action then opens its drawer again and
 * it stays open.
 *
 * The report did not reproduce in Chromium (browser back, in-app back, 6x CPU
 * throttle, iOS user agent). This spec holds the contract so a regression in
 * the nuqs/vaul/router interplay fails here first.
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

// Records every distinct drawer state the page passes through, so a drawer
// that shows for a single frame still fails the test.
async function recordDrawerStates(page: Page) {
    await page.evaluate(() => {
        const states: number[] = []
        const read = () => {
            const open = document.querySelectorAll('[data-vaul-drawer][data-state="open"]').length
            if (states.at(-1) !== open) states.push(open)
        }
        new MutationObserver(read).observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['data-state'],
        })
        read()
        ;(window as unknown as { __drawerStates: number[] }).__drawerStates = states
    })
}

const drawerStates = (page: Page) =>
    page.evaluate(() => (window as unknown as { __drawerStates: number[] }).__drawerStates)

const CASES = [
    { action: 'send', row: 'home-drawer-send-send-friends', destination: /\/send/ },
    { action: 'add', row: 'home-drawer-add-crypto', destination: /\/add-money\/crypto/ },
]

test.describe('home drawers and Back', () => {
    for (const { action, row, destination } of CASES) {
        test(`${action}: Back lands on a closed home and the drawer opens again`, async ({ page }) => {
            await suppressBalanceWarning(page)
            await page.goto('/home?__fixture=home', { waitUntil: 'domcontentloaded' })

            const submenu = page.getByTestId(`home-submenu-${action}`)
            await submenu.click({ timeout: 60_000 })
            await page.getByTestId(row).click()
            await page.waitForURL(destination, { timeout: 60_000 })

            await recordDrawerStates(page)
            await page.goBack()
            await page.waitForURL(/\/home/)
            await expect(submenu).toBeVisible()
            expect(new URL(page.url()).searchParams.get('drawer')).toBeNull()
            // never open at any point on the way back
            expect(await drawerStates(page)).toEqual([0])

            await recordDrawerStates(page)
            await submenu.click()
            await expect(page.getByTestId(row)).toBeVisible()
            // give a spurious close the time it would need to land
            await page.waitForTimeout(1_000)
            expect(await drawerStates(page)).toEqual([0, 1])
            await expect(page.getByTestId(row)).toBeVisible()
        })
    }
})
