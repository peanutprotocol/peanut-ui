/**
 * Public routes — accessible WITHOUT auth.
 *
 * These are the pages that show the same thing whether a user is logged in
 * or not. They're the stable foundation of the harness — if these render
 * differently after an M2 refactor, something really broke.
 */

import { test } from '@playwright/test'
import { captureStep, collectConsoleLogs } from '../utils/capture'
import { dismissModals } from '../utils/dismiss-modals'

test.describe('Public routes', () => {
    test('landing page', async ({ page }, testInfo) => {
        const c = collectConsoleLogs(page)
        await page.goto('/', { waitUntil: 'domcontentloaded' })
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-landing' })
        await page.waitForTimeout(2000)
        await captureStep(page, testInfo, { name: '02-landing-settled' })
        c.flush(testInfo, 'landing')
    })

    test('support page', async ({ page }, testInfo) => {
        const c = collectConsoleLogs(page)
        await page.goto('/support', { waitUntil: 'domcontentloaded' })
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-support' })
        c.flush(testInfo, 'support')
    })

    test('claim without pubKey', async ({ page }, testInfo) => {
        const c = collectConsoleLogs(page)
        await page.goto('/claim', { waitUntil: 'domcontentloaded' })
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-claim-no-pubkey' })
        c.flush(testInfo, 'claim')
    })

    test('claim with invalid pubKey', async ({ page }, testInfo) => {
        const c = collectConsoleLogs(page)
        await page.goto('/claim?pubKey=0xinvalid', { waitUntil: 'domcontentloaded' })
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-claim-invalid' })
        await page.waitForTimeout(2000)
        await captureStep(page, testInfo, { name: '02-claim-invalid-settled' })
        c.flush(testInfo, 'claim-invalid')
    })

    test('invite landing', async ({ page }, testInfo) => {
        const c = collectConsoleLogs(page)
        await page.goto('/invite', { waitUntil: 'domcontentloaded' })
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-invite' })
        c.flush(testInfo, 'invite')
    })

    test('qr landing', async ({ page }, testInfo) => {
        const c = collectConsoleLogs(page)
        await page.goto('/qr', { waitUntil: 'domcontentloaded' })
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-qr' })
        c.flush(testInfo, 'qr')
    })
})
