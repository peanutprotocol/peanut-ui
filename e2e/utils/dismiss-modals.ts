import type { Page } from '@playwright/test'

/**
 * Dismiss any blocking modals/overlays that appear on page load.
 * The app has several modals that block interaction:
 *   - "Peanut is mobile first!" dialog (Got it! button)
 *   - "Install Peanut on your phone" PWA install screen (Skip button)
 *   - Various other modals with close/X buttons
 *
 * Call this after every page.goto() in tests.
 */
export async function dismissModals(page: Page) {
    for (let attempt = 0; attempt < 5; attempt++) {
        // "Got it!" button on mobile-first modal
        const gotIt = page.locator('button:has-text("Got it!")')
        if (await gotIt.isVisible({ timeout: 1_500 }).catch(() => false)) {
            await gotIt.click()
            await page.waitForTimeout(500)
            continue
        }

        // "Skip" button on PWA install screen
        const skip = page.locator('button:has-text("Skip"), text=Skip').first()
        if (await skip.isVisible({ timeout: 1_500 }).catch(() => false)) {
            await skip.click()
            await page.waitForTimeout(500)
            continue
        }

        // Generic close button on any remaining dialog
        const close = page.locator('button[aria-label="Close"], dialog button:last-of-type').first()
        if (await close.isVisible({ timeout: 500 }).catch(() => false)) {
            await close.click()
            await page.waitForTimeout(500)
            continue
        }

        break
    }
}
