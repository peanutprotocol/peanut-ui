/**
 * "ID verified" (/verified, add-money proposal rules 1-3): each bank row says where its account stands in
 * Aleks's words, crypto always works, the name chip's check waits for a working account, and "Action needed" opens
 * the step itself. UI state only: every API answer comes from a fixture (`?__fixture=verified-*`,
 * src/dev/fixtures/registry.ts). The approval routing is unit-tested (useMultiPhaseKycFlow,
 * PaperworkVerificationFlow); backend truth belongs to Nutcracker.
 */

import { expect, test, type Page } from '@playwright/test'
import { dismissModals } from '../utils/dismiss-modals'

test.use({ viewport: { width: 375, height: 667 } })

async function open(page: Page, fixture: string) {
    await page.goto(`/verified?__fixture=${fixture}`, { waitUntil: 'domcontentloaded' })
    await page.addStyleTag({ content: '[data-fixture-banner]{display:none!important}' })
    await dismissModals(page)
    await expect(page.getByRole('heading', { name: 'ID verified' })).toBeVisible({ timeout: 60_000 })
}

const row = (page: Page, method: string) => page.getByTestId(`verified-method-${method}`)

test('rows load in place while the accounts open; crypto works at once', async ({ page }) => {
    await open(page, 'verified-loading')
    await expect(row(page, 'ars')).toHaveAttribute('aria-label', 'ARS')
    await expect(row(page, 'bank')).not.toHaveAttribute('role', 'button')
    await expect(row(page, 'crypto')).toHaveText(/From wallets or exchanges$/)
    await expect(page.getByTestId('name-chip')).not.toHaveAttribute('data-verified')
})

test('a provider review says so and still opens; a step to take opens that step', async ({ page }) => {
    await open(page, 'verified-not-ready')
    await expect(row(page, 'ars')).toContainText('Under review by Manteca, we’ll notify you')
    await expect(row(page, 'ars')).toHaveAttribute('role', 'button')
    await expect(row(page, 'ars')).not.toHaveAttribute('aria-disabled')
    await expect(row(page, 'bank')).toContainText('Action needed, Bridge’s terms for USD and EUR')
    await expect(row(page, 'crypto')).toContainText('From wallets or exchanges, works now')
    await expect(page.getByTestId('name-chip')).not.toHaveAttribute('data-verified')

    await row(page, 'bank').click()
    // today's terms step, over the page
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page).toHaveURL(/\/verified/)
})

test('an account the API did not open on approval is a row that opens it, with no wait', async ({ page }) => {
    await open(page, 'verified-not-opened')
    await expect(row(page, 'bank')).toHaveAttribute('role', 'button')
    await expect(row(page, 'bank')).toContainText('From your bank account')
    await expect(page.getByTestId('name-chip')).not.toHaveAttribute('data-verified')
})

test('once an account works the chip shows its check and every row opens', async ({ page }) => {
    await open(page, 'verified-ready')
    await expect(page.getByTestId('name-chip')).toHaveAttribute('data-verified', 'true')
    await expect(row(page, 'ars')).toContainText('From your Mercado Pago or bank account')
    await expect(row(page, 'bank')).toContainText('From your bank account')
    await row(page, 'crypto').click()
    await expect(page).toHaveURL(/\/add-money\/crypto\?returnTo=%2Fverified%3Fvisit%3D\d+/)
    // Back lands on the page's own history entry, which carries the same token: the same visit, no new view
    await page.goBack()
    await expect(page).toHaveURL(/\/verified\?.*visit=\d+/)
})

test('in Brazil Pix leads on the Avenia route', async ({ page }) => {
    await open(page, 'verified-brazil')
    const rows = page.getByTestId(/^verified-method-/)
    await expect(rows.first()).toHaveAttribute('data-testid', 'verified-method-pix')
    await expect(row(page, 'bank')).toContainText('Under review by Bridge')
})

test('Maybe later goes Home', async ({ page }) => {
    await open(page, 'verified-ready')
    await page.getByTestId('verified-later').click()
    await expect(page).toHaveURL(/\/home/)
})
