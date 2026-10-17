/**
 * EURC accounts on the fixture session (R3): the euro account view, and a
 * send up to its review screen. UI-state assertions only.
 *
 * `?__fixture=home-eurc` gives a signed-in user an existing EURC account; the
 * demo answers capabilities, history and prepare in the browser, so no API,
 * chain or passkey is involved and nothing is signed. The step and selected
 * item live in the URL (R4), so a reload on the send form stays on it.
 *
 * Signing, submission and settlement belong in the Nutcracker harness.
 */

import { test, expect, type Page } from '@playwright/test'

// The fixture balance can trip the non-dismissible high-balance sheet, which
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

const searchParam = (page: Page, name: string) => new URL(page.url()).searchParams.get(name)

test.describe('EURC accounts', () => {
    test('shows the euro account, keeps the send form across a reload, and reaches review', async ({ page }) => {
        await suppressBalanceWarning(page)
        await page.goto('/home?__fixture=home-eurc', { waitUntil: 'domcontentloaded' })

        const eurTab = page.getByRole('tab', { name: 'EUR' })
        await eurTab.click({ timeout: 60_000 })
        await expect(eurTab).toHaveAttribute('aria-selected', 'true')
        await expect(page.getByRole('heading', { name: 'EUR account' })).toBeVisible()
        for (const action of ['Receive EUR', 'Send EUR', 'Exchange', 'Add euros', 'Withdraw euros']) {
            await expect(page.getByRole('button', { name: action, exact: true })).toBeVisible()
        }
        await expect(page.getByRole('heading', { name: 'Euro activity' })).toBeVisible()
        await expect(page.getByText('No euro activity yet.')).toBeVisible()
        await expect.poll(() => searchParam(page, 'currency')).toBe('EURC')

        await page.getByRole('button', { name: 'Send EUR', exact: true }).click()
        await expect.poll(() => searchParam(page, 'action')).toBe('SEND')

        await page.reload({ waitUntil: 'domcontentloaded' })
        const amount = page.getByLabel(/Amount/)
        await expect(amount).toBeVisible({ timeout: 60_000 })
        await amount.fill('1.5')
        await page.getByLabel('Recipient').fill(`0x${'22'.repeat(20)}`)
        await page.getByRole('button', { name: 'Review', exact: true }).click()

        await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible()
        await expect(page.getByText('1.5 EURC')).toBeVisible()
        await expect(page.getByText(`Recipient: 0x${'22'.repeat(20)}`)).toBeVisible()
        await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeVisible()
        await expect.poll(() => searchParam(page, 'operation')).toMatch(/^[0-9a-f-]{36}$/)
    })
})
