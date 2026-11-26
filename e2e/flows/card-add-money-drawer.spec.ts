/**
 * Add money in place on the card's $10 step (TASK-25169): Crypto and Bank open a drawer over
 * /card?card_step=funding instead of leaving for /add-money, where 4 in 5 users never came back.
 *
 * UI state only: every answer comes from a `card-add-money-*` fixture (src/dev/fixtures/registry.ts),
 * each with $3.20 spendable, so nothing here reaches Rhino, a bank provider or a chain. Each
 * fixture's bank state is pinned through the real readiness code in
 * src/dev/fixtures/__tests__/cardAddMoney.fixtures.test.tsx.
 */

import { expect, test, type Page } from '@playwright/test'
import { fixtureHref } from '../../src/dev/fixtures/active'
import { FIXTURES } from '../../src/dev/fixtures/registry'
import { blockExternal, seenOnceModals, settle } from '../shots/fixture-page'

test.use({ viewport: { width: 375, height: 667 } })

/** Opens the funding step on a fixture and records every main-frame URL the page visits from then on. */
async function openFundingStep(page: Page, name: string): Promise<string[]> {
    const visited: string[] = []
    page.on('framenavigated', (frame) => {
        if (frame === page.mainFrame()) visited.push(frame.url())
    })
    await blockExternal(page, name)
    await page.addInitScript(seenOnceModals, 'US')
    await page.goto(fixtureHref(FIXTURES[name].route, name), { waitUntil: 'domcontentloaded' })
    await page.addStyleTag({ content: '[data-fixture-banner]{display:none!important}' })
    return visited
}

/** The step never hands the user to /add-money: every URL it visited, and the current one, is the funding step. */
function expectStayedOnFundingStep(page: Page, visited: string[]) {
    for (const href of [...visited, page.url()]) {
        const url = new URL(href)
        expect(url.pathname, href).toBe('/card')
        expect(url.searchParams.get('card_step'), href).toBe('funding')
    }
}

const drawer = (page: Page) => page.getByTestId('card-add-money-drawer')

test.describe('card $10 step: add money in place', () => {
    test('the crypto row opens the drawer on the network list', async ({ page }) => {
        const visited = await openFundingStep(page, 'card-add-money-crypto')
        await page.getByTestId('card-add-money-crypto').click({ timeout: 60_000 })
        await expect(drawer(page)).toBeVisible()
        for (const network of ['evm', 'sol', 'tron']) {
            await expect(drawer(page).getByTestId(`choose-network-${network}`)).toBeVisible()
        }
        expectStayedOnFundingStep(page, visited)
    })

    test('EVM opens the address view with the ask', async ({ page }) => {
        const visited = await openFundingStep(page, 'card-add-money-crypto')
        await page.getByTestId('card-add-money-crypto').click({ timeout: 60_000 })
        await drawer(page).getByTestId('choose-network-evm').click()
        await expect(drawer(page).getByTestId('card-add-money-address')).toBeVisible()
        // $6.80 short of the card, raised to the $10 network minimum so the deposit cannot strand
        await expect(drawer(page).getByTestId('card-add-money-ask')).toContainText('10')
        expectStayedOnFundingStep(page, visited)
    })

    test('bank with two accounts: the list, one account’s details, and back to the list', async ({ page }) => {
        const visited = await openFundingStep(page, 'card-add-money-bank-two')
        await page.getByTestId('card-add-money-bank').click({ timeout: 60_000 })
        const euro = drawer(page).getByTestId('card-add-money-rail-sepa_eu')
        const dollar = drawer(page).getByTestId('card-add-money-rail-ach_us')
        await expect(euro).toBeVisible()
        await expect(dollar).toBeVisible()

        await dollar.click()
        await expect(drawer(page).getByTestId('card-add-money-bank-details')).toBeVisible()
        await expect(euro).toBeHidden()

        await drawer(page).getByTestId('nav-back').click()
        await expect(drawer(page).getByTestId('card-add-money-bank-details')).toBeHidden()
        await expect(euro).toBeVisible()
        await expect(dollar).toBeVisible()
        expectStayedOnFundingStep(page, visited)
    })

    test('not verified: the bank view says so, with Verify identity and a crypto way out', async ({ page }) => {
        const visited = await openFundingStep(page, 'card-add-money-not-verified')
        await page.getByTestId('card-add-money-bank').click({ timeout: 60_000 })
        await expect(drawer(page).getByTestId('card-add-money-status-not-verified')).toBeVisible()
        await expect(drawer(page).getByTestId('card-add-money-verify')).toBeVisible()
        await expect(drawer(page).getByTestId('card-add-money-use-crypto')).toBeVisible()
        expectStayedOnFundingStep(page, visited)
    })

    test('no bank offered: the bank row sorts last, disabled, and its tap opens nothing (Kush)', async ({ page }) => {
        const visited = await openFundingStep(page, 'card-add-money-bank-not-offered')
        await expect(page.getByTestId('card-add-money-crypto')).toBeVisible({ timeout: 60_000 })
        // the bank decision waits on the capability and account reads; the order only counts once they settle
        await settle(page)
        const rows = page.getByTestId(/^card-add-money-(bank|crypto)$/)
        await expect(rows.last()).toHaveAttribute('data-testid', 'card-add-money-bank')
        await expect(page.getByTestId('card-add-money-bank')).toHaveAttribute('aria-disabled', 'true')
        await page.getByTestId('card-add-money-bank').click({ force: true })
        await expect(drawer(page)).toBeHidden()
        expectStayedOnFundingStep(page, visited)
    })
})
