/**
 * Back never loops (TASK-23054).
 *
 * A back control that pushed its parent left the child under it in history,
 * so the next back reopened the child: Accounts and payments → account
 * details → back → Accounts and payments → back → account details again.
 * Flow exits now rewind to the page they were opened from, and NavHeader's
 * default back pops history, so each back press moves one page outward and
 * browser back from the destination never re-enters the flow.
 *
 * No API and no login: `?__fixture=` fakes the session and every answer.
 */

import { test, expect, type Page } from '@playwright/test'

// The fixtures' balance trips the non-dismissible high-balance sheet, which
// covers the page. Mark it seen for whichever user the fixture uses.
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

const pathOf = (page: Page) => new URL(page.url()).pathname

async function navBack(page: Page) {
    await page.getByTestId('nav-back').first().click()
}

test.describe('back navigation', () => {
    test.beforeEach(async ({ page }) => {
        await suppressBalanceWarning(page)
    })

    test('accounts → account details → back twice leaves to profile, not details', async ({ page }) => {
        await page.goto('/home?__fixture=get-paid', { waitUntil: 'domcontentloaded' })
        await page.locator('a[href="/profile"]').first().click({ timeout: 60_000 })
        await page.waitForURL(/\/profile$/)
        // by href: the page is being split into Accounts and Payments (ui#3461)
        await page.locator('a[href^="/profile/accounts"]').first().click()
        await page.waitForURL(/\/profile\/accounts/)

        await page.getByTestId('deposit-account-SEPA_EU').click()
        await page.waitForURL(/step=details/)

        await navBack(page)
        await page.waitForURL(/\/profile\/accounts/)
        await expect(page.getByTestId('deposit-account-SEPA_EU')).toBeVisible()

        await navBack(page)
        await page.waitForURL((url) => url.pathname === '/profile')
        // and browser back from profile goes further out, not into the flow
        await page.goBack()
        await page.waitForURL(/\/home/)
        expect(pathOf(page)).toBe('/home')
    })

    test('add money hub: back lands on home, and browser back from home does not reopen the hub', async ({ page }) => {
        await page.goto('/home?__fixture=get-paid', { waitUntil: 'domcontentloaded' })
        await page.getByTestId('home-submenu-add').click({ timeout: 60_000 })
        await page.getByTestId('home-drawer-add-bank').click()
        await page.waitForURL(/\/add-money\?method=bank/)
        await expect(page.getByTestId('deposit-account-SEPA_EU')).toBeVisible()

        await navBack(page)
        await page.waitForURL(/\/home/)
        await expect(page.getByTestId('home-submenu-add')).toBeVisible()

        await page.goBack()
        // home was the first entry: back leaves the app instead of reopening the hub
        expect(page.url()).not.toContain('/add-money')
    })

    test('activity: header back returns home, and browser back from home does not reopen activity', async ({
        page,
    }) => {
        await page.goto('/home?__fixture=get-paid', { waitUntil: 'domcontentloaded' })
        await page.locator('a[href="/history"]').first().click({ timeout: 60_000 })
        await page.waitForURL(/\/history/)

        await navBack(page)
        await page.waitForURL(/\/home/)
        await expect(page.getByTestId('home-submenu-add')).toBeVisible()

        await page.goBack()
        expect(page.url()).not.toContain('/history')
    })
})
