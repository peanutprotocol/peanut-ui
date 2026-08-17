/**
 * Dev routes — design system showcase + component gallery.
 *
 * These are the CRITICAL snapshots for M2. When we kill MUI, flow contexts,
 * or Redux, the design system showcase should still render identically.
 *
 * The dev showcase renders every Bruddle primitive + Global component with
 * every variant — the canonical regression target.
 */

import { test } from '@playwright/test'
import { captureStep, collectConsoleLogs } from '../utils/capture'
import { dismissModals } from '../utils/dismiss-modals'

test.describe('Dev showcase (design system)', () => {
    test('/dev — root dev page', async ({ page }, testInfo) => {
        const c = collectConsoleLogs(page)
        await page.goto('/dev', { waitUntil: 'domcontentloaded' })
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-dev-root' })
        c.flush(testInfo, 'dev-root')
    })

    test('/dev/ds — design system root', async ({ page }, testInfo) => {
        const c = collectConsoleLogs(page)
        await page.goto('/dev/ds', { waitUntil: 'domcontentloaded' })
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-ds-root' })
        await page.waitForTimeout(1500)
        await captureStep(page, testInfo, { name: '02-ds-root-settled' })
        c.flush(testInfo, 'ds-root')
    })
})
