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

// a Spanish IBAN; SEPA asks for nothing else
const SEPA_IBAN = 'ES9121000418450200051332'

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
    /*
     * The disabled state, which is what a user sees first and for longest.
     * `scrollClearOfBottomNav` only fires once the form can be submitted, so
     * nothing moves the button here — the page's own bottom reservation has to
     * be enough. Held for the three corridors with the most fields; the form is
     * left EMPTY on purpose.
     */
    for (const [corridor, path] of [
        ['the euro area', '/withdraw/spain'],
        ['the United States', '/withdraw/usa'],
        ['Mexico', '/withdraw/mexico'],
    ] as const) {
        test(`${corridor}: an empty form's disabled button is reachable and clear of the nav`, async ({ page }) => {
            await page.goto(`${path}?step=form&__fixture=withdraw-bank-form`, { waitUntil: 'domcontentloaded' })
            await page.addStyleTag({ content: '[data-fixture-banner]{display:none!important}' })
            const button = page.getByTestId('bank-form-cta').locator('button')
            await expect(button).toBeVisible({ timeout: 60_000 })
            await expect(button).toBeDisabled()

            // the user's own scroll to the end of the page, and nothing else
            await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }))
            await expect.poll(() => tapTargetAtCentre(page), { timeout: 10_000 }).toBe('button')

            // and the last field's paste control is not covered either — it sits
            // at the interactive edge nearest the nav
            const covered = await page.evaluate(() => {
                const controls = Array.from(document.querySelectorAll('form button[aria-label="Paste from clipboard"]'))
                return controls
                    .filter((el) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().top > 0)
                    .filter((el) => {
                        const box = el.getBoundingClientRect()
                        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
                        return !(hit && el.contains(hit))
                    }).length
            })
            expect(covered).toBe(0)
        })
    }

    test('is clear of the bottom nav as soon as the form can be submitted', async ({ page }) => {
        await page.goto('/withdraw/spain?step=form&__fixture=withdraw-bank-form', { waitUntil: 'domcontentloaded' })
        // the dev fixture banner is fixed over the bottom of the page; it is not part of the app
        await page.addStyleTag({ content: '[data-fixture-banner]{display:none!important}' })
        const button = page.getByTestId('bank-form-cta').locator('button')
        await expect(button).toBeVisible({ timeout: 60_000 })

        // Filled from the top down, the way a user does, with no scrolling of
        // our own: Playwright scrolls a field into view to type, as a tap does.
        await page.locator('#bank-accountOwnerName').fill('Ana Silva')
        await page.locator('#bank-accountNumber').fill(SEPA_IBAN)
        await page.locator('#bank-accountNumber').blur()
        // no BIC field on a SEPA rail: the IBAN is the whole account group
        await expect(page.locator('#bank-bic')).toHaveCount(0)
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
})
