/**
 * Statements (Profile → Statements): the Profile entry, the period and format
 * URL contract, the custom period drawer, and the export request the page
 * builds.
 *
 * `?__fixture=peer-avatars` supplies the session. In fixture mode no API call
 * reaches the network, so page.on('request') sees nothing; the fixture
 * responder records every call on `window.__fixtureRequests` once a spec
 * creates that list, and the spec reads the export request there. The fixture
 * answers the export with JSON instead of a file, so every download ends in
 * the generic failure. Which rows the API puts in the file is backend truth
 * and belongs to Nutcracker.
 */

import { expect, test, type Page } from '@playwright/test'
import { dismissModals } from '../utils/dismiss-modals'

const FIXTURE = 'peer-avatars'
const STATEMENTS = `/profile/statements?__fixture=${FIXTURE}`
const EXPORT_CALL = 'GET /users/history/export?'

// A month that is wholly in the past, so every day in the grid is selectable
// (the calendar disables the future).
const LAST_MONTH = (() => {
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() - 1)
    return date
})()
const lastMonthDay = (day: number) =>
    `${LAST_MONTH.getFullYear()}-${String(LAST_MONTH.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

async function open(page: Page, url: string) {
    await page.goto(url)
    await dismissModals(page)
}

const periodSelect = (page: Page) => page.getByRole('combobox', { name: 'Period' })
// by name: the Support sheet is a dialog too, mounted off screen on every page
const drawer = (page: Page) => page.getByRole('dialog', { name: 'Custom period' })

async function choosePeriod(page: Page, name: string) {
    await periodSelect(page).click()
    await page.getByRole('option', { name }).click()
}

async function tapDay(page: Page, day: number) {
    await page.locator(`[data-day="${lastMonthDay(day)}"] button`).click()
}

// The calendar opens on the month of the applied period, or on this month, so
// step back only when last month is not the one on screen.
async function showLastMonth(page: Page) {
    const probe = page.locator(`[data-day="${lastMonthDay(3)}"]`)
    if (!(await probe.isVisible().catch(() => false))) {
        await page.getByRole('button', { name: /previous month/i }).click()
    }
    await expect(probe).toBeVisible()
}

/** The export calls the page made, as URL query strings. */
const exportQueries = (page: Page) =>
    page.evaluate(
        (prefix) =>
            ((window as unknown as { __fixtureRequests?: string[] }).__fixtureRequests ?? [])
                .filter((call) => call.startsWith(prefix))
                .map((call) => call.slice(prefix.length)),
        EXPORT_CALL
    )

/** Local midnight of the first day, and local midnight after the last day (the API's `to` is exclusive). */
const apiBounds = (page: Page, from: string, to: string) =>
    page.evaluate(
        ([first, last]) => {
            const [y1, m1, d1] = first.split('-').map(Number)
            const [y2, m2, d2] = last.split('-').map(Number)
            return {
                from: new Date(y1, m1 - 1, d1).toISOString(),
                to: new Date(y2, m2 - 1, d2 + 1).toISOString(),
            }
        },
        [from, to]
    )

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        ;(window as unknown as { __fixtureRequests: string[] }).__fixtureRequests = []
    })
})

test('Profile lists Statements right under Language, and the row opens the page', async ({ page }) => {
    await open(page, `/profile?__fixture=${FIXTURE}`)

    const row = page.locator('a[href="/settings/language"] + a[href="/profile/statements"]')
    await expect(row).toHaveText('Statements')
    await row.click()

    await expect(page).toHaveURL(/\/profile\/statements/)
    await expect(page.getByRole('button', { name: 'Download' })).toBeVisible()
})

test('a deep link opens on Custom period with the drawer closed, and with its format chosen', async ({ page }) => {
    await open(page, `${STATEMENTS}&from=${lastMonthDay(3)}&to=${lastMonthDay(12)}&format=xlsx`)

    await expect(periodSelect(page)).toHaveText(/Custom period/)
    await expect(page.getByRole('radio', { name: /^XLSX/ })).toBeChecked()
    await expect(drawer(page)).toHaveCount(0)

    // the drawer opens on the linked days
    await page.getByRole('button', { name: 'Change dates' }).click()
    await expect(page.locator(`[data-day="${lastMonthDay(3)}"]`)).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator(`[data-day="${lastMonthDay(12)}"]`)).toHaveAttribute('aria-selected', 'true')
})

test('a preset and a format row write the period and format to the url', async ({ page }) => {
    await open(page, STATEMENTS)

    await choosePeriod(page, 'Last 30 days')
    await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}/)
    await expect(page).toHaveURL(/to=\d{4}-\d{2}-\d{2}/)

    await page.getByText('For spreadsheets and accounting').click()
    await expect(page).toHaveURL(/format=csv/)
    await expect(page.getByRole('radio', { name: /^CSV/ })).toBeChecked()
    await expect(page.getByRole('radio', { name: /^PDF/ })).not.toBeChecked()

    // all time is no period at all
    await choosePeriod(page, 'All time')
    await expect(page).not.toHaveURL(/from=/)
    await expect(page).not.toHaveURL(/to=/)
})

test('a custom period is picked in the drawer and written on Apply, and a later tap starts over', async ({ page }) => {
    await open(page, STATEMENTS)

    await choosePeriod(page, 'Custom period')
    await expect(drawer(page).getByRole('heading', { name: 'Custom period' })).toBeVisible()
    // no day picked yet: nothing to apply
    await expect(drawer(page).getByRole('button', { name: 'Apply' })).toBeDisabled()

    await showLastMonth(page)
    await tapDay(page, 3)
    await tapDay(page, 12)
    // taps change the drawer, not the page
    await expect(page).not.toHaveURL(/from=/)
    await drawer(page).getByRole('button', { name: 'Apply' }).click()

    await expect(drawer(page)).toBeHidden()
    await expect(page).toHaveURL(new RegExp(`from=${lastMonthDay(3)}`))
    await expect(page).toHaveURL(new RegExp(`to=${lastMonthDay(12)}`))
    await expect(periodSelect(page)).toHaveText(/Custom period/)

    // "Custom period" is already chosen, so its dates change from the line under
    // the field. The reported bug: a tap on a finished range used to move its end
    // instead of starting a new range. A first tap alone is a one-day period.
    await page.getByRole('button', { name: 'Change dates' }).click()
    await expect(page.locator(`[data-day="${lastMonthDay(3)}"]`)).toHaveAttribute('aria-selected', 'true')
    await tapDay(page, 20)
    await drawer(page).getByRole('button', { name: 'Apply' }).click()
    await expect(page).toHaveURL(new RegExp(`from=${lastMonthDay(20)}`))
    await expect(page).toHaveURL(new RegExp(`to=${lastMonthDay(20)}`))
})

test('closing the drawer without Apply keeps the period chosen before', async ({ page }) => {
    await open(page, STATEMENTS)
    await choosePeriod(page, 'Last 30 days')
    await expect(page).toHaveURL(/from=/)
    const before = page.url()

    await choosePeriod(page, 'Custom period')
    await showLastMonth(page)
    await tapDay(page, 5)
    await page.keyboard.press('Escape')
    await expect(drawer(page)).toBeHidden()
    await expect(periodSelect(page)).toHaveText(/Last 30 days/)
    expect(page.url()).toBe(before)

    // a tap on the overlay above the sheet
    await choosePeriod(page, 'Custom period')
    await expect(drawer(page)).toBeVisible()
    await page.mouse.click(187, 40)
    await expect(drawer(page)).toBeHidden()
    await expect(periodSelect(page)).toHaveText(/Last 30 days/)
    expect(page.url()).toBe(before)

    // the page still takes taps once the sheet is gone
    await choosePeriod(page, 'All time')
    await expect(page).not.toHaveURL(/from=/)
})

test('Download asks the API for the chosen format and period, in the app locale', async ({ page }) => {
    await open(page, `${STATEMENTS}&from=${lastMonthDay(3)}&to=${lastMonthDay(12)}&format=csv`)

    await page.getByRole('button', { name: 'Download' }).click()
    await expect.poll(() => exportQueries(page)).toHaveLength(1)

    const [query] = await exportQueries(page)
    const params = new URLSearchParams(query)
    const bounds = await apiBounds(page, lastMonthDay(3), lastMonthDay(12))
    expect(params.get('format')).toBe('csv')
    expect(params.get('from')).toBe(bounds.from)
    expect(params.get('to')).toBe(bounds.to)
    expect(params.get('locale')).toBe(await page.evaluate(() => document.documentElement.lang))
    expect(params.get('timeZone')).toBe(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone))

    // the fixture answers with JSON, not a file. (The fixture strip is an alert too.)
    await expect(page.getByRole('alert').filter({ hasText: 'Download failed. Try again.' })).toBeVisible()
})

test.describe('in Brazilian Portuguese', () => {
    test.use({ locale: 'pt-BR' })

    test('Download sends the app locale, and all time sends no bounds', async ({ page }) => {
        await open(page, STATEMENTS)
        await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('pt-BR')

        await page.getByRole('button', { name: 'Baixar' }).click()
        await expect.poll(() => exportQueries(page)).toHaveLength(1)

        const params = new URLSearchParams((await exportQueries(page))[0])
        expect(params.get('locale')).toBe('pt-BR')
        expect(params.get('format')).toBe('pdf')
        expect(params.has('from')).toBe(false)
        expect(params.has('to')).toBe(false)
    })
})
