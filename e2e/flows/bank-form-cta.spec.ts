/**
 * The bank form's submit button must be tappable the moment it can be pressed.
 *
 * The form is taller than a small phone. At 375x667 its button rested half
 * behind the bottom nav: on screen, and a tap at its centre landed on the nav
 * and switched tabs. A screenshot passes that state, so this asks the browser
 * what a tap at the button's centre would hit.
 *
 * The window scrolls this page, not the shell's own scroller, so nothing short
 * of a fixed bar can hold the button above the nav while the form is still
 * empty and the button disabled. What the form does is bring the button clear
 * of the nav as soon as it becomes submittable, with no scroll from the user.
 * That is the contract held here.
 *
 * No API and no login: `?__fixture=withdraw-bank-form` fakes the session.
 */

import { test, expect, type Page } from '@playwright/test'

test.use({ viewport: { width: 375, height: 667 } })

// CaixaBank: a bank the bundled table knows, so the BIC derives and its field hides
const DERIVABLE_IBAN = 'ES9121000418450200051332'

// an Italian IBAN: the bundled table has no BIC for it, so the field stays
const UNDERIVABLE_IBAN = 'IT60X0542811101000000123456'

/** What a tap at the button's centre lands on: the button itself, or whatever covers it. */
async function tapTargetAtCentre(page: Page) {
    return page.getByTestId('bank-form-cta').evaluate((cta) => {
        const button = cta.querySelector('button')
        if (!button) return 'no button'
        const box = button.getBoundingClientRect()
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
        if (hit && button.contains(hit)) return 'button'
        if (!hit) return 'nothing'
        // name the element that took the tap, so a failure says what covers the button
        const where = hit.closest('nav') ? ' inside the bottom nav' : ''
        const label = hit.getAttribute('data-testid') ?? hit.className.toString().slice(0, 80)
        return `<${hit.tagName.toLowerCase()} ${label}>${where} at y=${Math.round(box.top + box.height / 2)}`
    })
}

test.describe('bank form submit button at 375x667', () => {
    test('is clear of the bottom nav as soon as the form can be submitted', async ({ page }) => {
        await page.goto('/withdraw/spain?step=form&__fixture=withdraw-bank-form', { waitUntil: 'domcontentloaded' })
        // the dev fixture banner is fixed over the bottom of the page; it is not part of the app
        await page.addStyleTag({ content: '[data-fixture-banner]{display:none!important}' })
        const button = page.getByTestId('bank-form-cta').locator('button')
        await expect(button).toBeVisible({ timeout: 60_000 })

        // Filled from the top down, the way a user does, with no scrolling of
        // our own: Playwright scrolls a field into view to type, as a tap does.
        await page.locator('#bank-accountOwnerName').fill('Ana Silva')
        await page.locator('#bank-accountNumber').fill(DERIVABLE_IBAN)
        await page.locator('#bank-accountNumber').blur()
        // the derived BIC hides its field, which is the shorter of the form's two heights
        await expect(page.locator('#bank-bic')).toHaveCount(0, { timeout: 30_000 })
        await page.locator('#bank-street').fill('Calle Mayor 1')
        await page.locator('#bank-city').fill('Madrid')
        await page.locator('#bank-postalCode').fill('28013')
        await page.locator('#bank-postalCode').blur()

        await expect(button).toBeEnabled({ timeout: 30_000 })
        // smooth scroll: give it the time to land
        await expect.poll(() => tapTargetAtCentre(page), { timeout: 10_000 }).toBe('button')

        // and its box does not touch the nav's. Polled, not read once: the
        // scroll that brings it clear is `behavior: 'smooth'`, and reading the
        // box mid-animation caught it 19px into the nav on 1 run of 7 while the
        // hit-test above had already passed.
        await expect
            .poll(
                () =>
                    page.evaluate(() => {
                        const cta = document
                            .querySelector('[data-testid="bank-form-cta"] button')
                            ?.getBoundingClientRect()
                        const nav = document.querySelector('nav')?.getBoundingClientRect()
                        if (!cta || !nav) return null
                        return Math.max(0, Math.min(cta.bottom, nav.bottom) - Math.max(cta.top, nav.top))
                    }),
                { timeout: 10_000 }
            )
            .toBe(0)
    })

    /*
     * The taller of the form's two heights. A BIC the bundled table cannot
     * derive keeps its field, which pushes the button a further 88px down, and
     * the page then scrolls 137px rather than 49 to bring it clear. Held
     * separately because the short form passing says nothing about this one:
     * the two differ by exactly the field that decides the height.
     */
    test('is clear of the bottom nav on the taller form, where the BIC field stays', async ({ page }) => {
        await page.goto('/withdraw/italy?step=form&__fixture=withdraw-bank-form', { waitUntil: 'domcontentloaded' })
        await page.addStyleTag({ content: '[data-fixture-banner]{display:none!important}' })
        const button = page.getByTestId('bank-form-cta').locator('button')
        await expect(button).toBeVisible({ timeout: 60_000 })

        await page.locator('#bank-accountOwnerName').fill('Giulia Rossi')
        await page.locator('#bank-accountNumber').fill(UNDERIVABLE_IBAN)
        await page.locator('#bank-accountNumber').blur()
        // the field stays: this is the form's taller height
        await expect(page.locator('#bank-bic')).toBeVisible({ timeout: 30_000 })
        await page.locator('#bank-bic').fill('BCITITMM')
        await page.locator('#bank-bic').blur()
        await page.locator('#bank-street').fill('Via Roma 1')
        await page.locator('#bank-city').fill('Roma')
        await page.locator('#bank-postalCode').fill('00100')
        await page.locator('#bank-postalCode').blur()

        await expect(button).toBeEnabled({ timeout: 30_000 })
        await expect.poll(() => tapTargetAtCentre(page), { timeout: 10_000 }).toBe('button')
    })
})
