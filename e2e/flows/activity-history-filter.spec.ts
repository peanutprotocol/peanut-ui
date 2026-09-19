/**
 * Activity history — timeframe filter and the hand-off to the export sheet.
 *
 * UI state only. The window is a URL contract (`?from=&to=`, local calendar
 * days) that the history query and the export request both read, so these
 * specs assert what the URL holds and what the sheets show. Whether the API
 * then returns the right rows is backend truth and belongs to Nutcracker; the
 * fixture answers every call with the same four entries regardless of range.
 *
 * `?__fixture=peer-avatars` supplies the session and those entries — the page
 * needs rows, because an account with no activity at all renders the empty
 * state, which deliberately carries no filter button.
 */

import { expect, test } from '@playwright/test'
import { dismissModals } from '../utils/dismiss-modals'

const HISTORY = '/history?__fixture=peer-avatars'

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

async function openFilter(page: import('@playwright/test').Page) {
    await page.getByTestId('history-filters').click()
    await expect(page.getByRole('button', { name: /^save$/i })).toBeVisible()
}

async function chooseCustomRange(page: import('@playwright/test').Page) {
    await page.getByRole('combobox').first().click()
    await page.getByRole('option', { name: /custom range/i }).click()
    // The calendar opens on the month of whatever range is already applied, so
    // step back only when last month is not the one on screen.
    const probe = page.locator(`[data-day="${lastMonthDay(3)}"]`)
    if (!(await probe.isVisible().catch(() => false))) {
        await page.getByRole('button', { name: /previous month/i }).click()
    }
    await expect(probe).toBeVisible()
}

test.beforeEach(async ({ page }) => {
    await page.goto(HISTORY)
    await dismissModals(page)
    await expect(page.getByTestId('history-filters')).toBeVisible()
})

test('a preset writes the window to the url and names it on the filter button', async ({ page }) => {
    await openFilter(page)
    await page.getByRole('combobox').first().click()
    await page.getByRole('option', { name: 'Last 30 days' }).click()
    await page.getByRole('button', { name: /^save$/i }).click()

    await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}/)
    await expect(page).toHaveURL(/to=\d{4}-\d{2}-\d{2}/)
    // the applied window is announced, not just tinted
    await expect(page.getByTestId('history-filters')).toHaveAccessibleName(/Last 30 days/)
})

test('a custom range spans the two picked days, and a later pick starts over', async ({ page }) => {
    await openFilter(page)
    await chooseCustomRange(page)
    await page.locator(`[data-day="${lastMonthDay(3)}"] button`).click()
    await page.locator(`[data-day="${lastMonthDay(12)}"] button`).click()
    await page.getByRole('button', { name: /^save$/i }).click()

    await expect(page).toHaveURL(new RegExp(`from=${lastMonthDay(3)}`))
    await expect(page).toHaveURL(new RegExp(`to=${lastMonthDay(12)}`))

    // the reported bug: tapping a day on a finished range used to move its end
    // instead of starting a new range
    await openFilter(page)
    await chooseCustomRange(page)
    await page.locator(`[data-day="${lastMonthDay(20)}"] button`).click()
    await page.getByRole('button', { name: /^save$/i }).click()

    await expect(page).toHaveURL(new RegExp(`from=${lastMonthDay(20)}`))
    await expect(page).toHaveURL(new RegExp(`to=${lastMonthDay(20)}`))
})

test('download hands the applied window to the export sheet', async ({ page }) => {
    await openFilter(page)
    await page.getByRole('combobox').first().click()
    await page.getByRole('option', { name: 'Last 7 days' }).click()
    await page.getByRole('button', { name: /^save$/i }).click()

    await openFilter(page)
    await page.getByRole('button', { name: /^download$/i }).click()

    // the sheet renders its title twice (the sr-only drawer title + the visible
    // heading), so match the dialog rather than the text
    const exportSheet = page.locator('[role="dialog"]').filter({ hasText: 'Export activity' }).last()
    await expect(exportSheet).toBeVisible()
    for (const format of ['PDF', 'CSV', 'XLSX']) {
        await expect(page.getByRole('tab', { name: format })).toBeVisible()
    }
    // the sheet starts from the window the filter applied
    await expect(page.getByText('Last 7 days').first()).toBeVisible()
})
