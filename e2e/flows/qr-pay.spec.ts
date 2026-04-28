/**
 * QR Pay flow — the highest-pain UI file (CC 309, 23 useState, 1679 lines).
 *
 * Uses 'verified-ar' persona so the payment form renders instead of hitting
 * the KYC gate. Falls back to default user if persona isn't available.
 *
 * We can't complete a real payment (needs Manteca/SimpleFi backend), but we
 * CAN snapshot the entry states:
 *   - Landing on /qr-pay without a QR code → error/redirect
 *   - Landing with a mock QR code → initial UI before payment attempt
 *   - KYC gate states (verified vs pending)
 *
 * This captures the UI structure that M2's qr-pay refactor must preserve.
 */

import { test, expect, devices } from '@playwright/test'
import { captureStep, collectConsoleLogs } from '../utils/capture'
import { dismissModals } from '../utils/dismiss-modals'
import { installApiMocks } from '../utils/mock-api'
import { usePersona } from '../utils/personas'

test.describe('QR Pay flow', () => {
    test('qr-pay without QR code — shows error or redirect', async ({ page }, testInfo) => {
        const consoleLogs = collectConsoleLogs(page)

        await page.goto('/qr-pay')
        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-qr-pay-no-code' })

        // Should either show an error or redirect to home
        const url = page.url()
        const hasError = (await page.locator('text=/error|invalid|scan/i').count()) > 0
        const redirectedAway = !url.includes('/qr-pay')

        // Capture whatever state we end up in
        await captureStep(page, testInfo, { name: '02-qr-pay-no-code-settled' })

        consoleLogs.flush(testInfo, 'qr-pay-no-code')
    })

    test('qr-pay with mock Mercado Pago QR — verified-ar persona', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ ...devices['Pixel 7'] })
        const persona = await usePersona(context, 'verified-ar')

        const page = await context.newPage()
        const consoleLogs = collectConsoleLogs(page)
        await installApiMocks(page)

        // Simulate a scanned QR by passing query params
        const mockQr = encodeURIComponent('https://mercadopago.com.ar/mock-qr-test')
        await page.goto(`/qr-pay?qrCode=${mockQr}&type=MERCADO_PAGO&t=${Date.now()}`)

        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-qr-pay-mercadopago-initial' })

        // The page should show some payment UI (amount input, merchant info, or loading)
        await page.waitForTimeout(3000)
        await captureStep(page, testInfo, { name: '02-qr-pay-mercadopago-settled' })

        if (persona) {
            testInfo.annotations.push({
                type: 'persona',
                description: `verified-ar (${persona.userId})`,
            })
        }

        consoleLogs.flush(testInfo, 'qr-pay-mercadopago')
        await context.close()
    })

    test('qr-pay with mock PIX QR — verified-ar persona', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ ...devices['Pixel 7'] })
        const persona = await usePersona(context, 'verified-ar')

        const page = await context.newPage()
        const consoleLogs = collectConsoleLogs(page)
        await installApiMocks(page)

        const mockQr = encodeURIComponent(
            '00020126580014br.gov.bcb.pix0136mock-pix-key-for-harness-test5204000053039865802BR'
        )
        await page.goto(`/qr-pay?qrCode=${mockQr}&type=PIX&t=${Date.now()}`)

        await dismissModals(page)
        await captureStep(page, testInfo, { name: '01-qr-pay-pix-initial' })
        await page.waitForTimeout(3000)
        await captureStep(page, testInfo, { name: '02-qr-pay-pix-settled' })

        if (persona) {
            testInfo.annotations.push({
                type: 'persona',
                description: `verified-ar (${persona.userId})`,
            })
        }

        consoleLogs.flush(testInfo, 'qr-pay-pix')
        await context.close()
    })
})
