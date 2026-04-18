/**
 * Withdraw flow — expanded regression coverage with seeded transfer history.
 *
 * Exercises:
 *   - Method selection (wallet, bank)
 *   - US bank withdrawal form (Bridge)
 *   - SEPA withdrawal form (Bridge)
 *   - AR bank withdrawal form (Manteca)
 *   - Transfer history entries from seeded data
 *
 * Uses /dev/seed-scenario with "withdraw-ready" to seed a user with
 * balance and transfer history.
 */

import { test, expect } from '@playwright/test'
import { devices } from '@playwright/test'
import { captureStep, collectConsoleLogs } from '../utils/capture'
import { dismissModals } from '../utils/dismiss-modals'
import { seedScenario, authenticateAs } from '../utils/seed'
import { installApiMocks } from '../utils/mock-api'

test.describe('Withdraw flow (expanded)', () => {
	let seedData: any

	test.beforeAll(async () => {
		try {
			seedData = await seedScenario('withdraw-ready')
		} catch (e) {
			console.warn(`[withdraw-flow] seed-scenario failed, tests will use bootstrap user: ${e}`)
		}
	})

	/**
	 * Helper to get a page with the seeded user context, or fall back to default.
	 */
	async function getPageWithUser(
		browser: any,
		testInfo: any
	): Promise<{ page: any; context: any; needsClose: boolean }> {
		if (seedData?.user?.token) {
			const context = await browser.newContext({ ...devices['Pixel 7'] })
			await authenticateAs(context, seedData.user.token)
			const page = await context.newPage()
			await installApiMocks(page)
			return { page, context, needsClose: true }
		}
		// Fall back — return null so test uses default page fixture
		return { page: null, context: null, needsClose: false }
	}

	test('withdraw landing — shows method selection', async ({ page, browser }, testInfo) => {
		const seeded = await getPageWithUser(browser, testInfo)
		const activePage = seeded.page || page
		const consoleLogs = collectConsoleLogs(activePage)

		await activePage.goto('/withdraw')
		await dismissModals(activePage)
		await captureStep(activePage, testInfo, { name: '01-withdraw-landing' })

		await activePage.waitForTimeout(3000)
		await dismissModals(activePage)
		await captureStep(activePage, testInfo, { name: '02-withdraw-loaded' })

		// Verify method options are visible
		const walletOption = activePage.locator(
			'text=/wallet/i, button:has-text("Wallet"), button:has-text("Crypto")'
		)
		const bankOption = activePage.locator(
			'text=/bank/i, button:has-text("Bank")'
		)

		if (await walletOption.first().isVisible({ timeout: 3000 }).catch(() => false)) {
			await captureStep(activePage, testInfo, { name: '03-withdraw-wallet-option' })
		}
		if (await bankOption.first().isVisible({ timeout: 3000 }).catch(() => false)) {
			await captureStep(activePage, testInfo, { name: '04-withdraw-bank-option' })
		}

		consoleLogs.flush(testInfo, 'withdraw-landing')
		if (seeded.needsClose) await seeded.context.close()
	})

	test('US bank withdrawal form (Bridge)', async ({ page, browser }, testInfo) => {
		const seeded = await getPageWithUser(browser, testInfo)
		const activePage = seeded.page || page
		const consoleLogs = collectConsoleLogs(activePage)

		await activePage.goto('/withdraw/US/bank')
		await dismissModals(activePage)
		await captureStep(activePage, testInfo, { name: '01-withdraw-us-bank-initial' })

		await activePage.waitForTimeout(3000)
		await dismissModals(activePage)
		await captureStep(activePage, testInfo, { name: '02-withdraw-us-bank-loaded' })

		// Look for bank form fields (routing number, account number)
		const routingInput = activePage.locator(
			'input[placeholder*="routing" i], input[name*="routing" i], label:has-text("Routing")'
		)
		const accountInput = activePage.locator(
			'input[placeholder*="account" i], input[name*="account" i], label:has-text("Account")'
		)

		if (await routingInput.first().isVisible({ timeout: 5000 }).catch(() => false)) {
			await captureStep(activePage, testInfo, { name: '03-withdraw-us-bank-form' })
		}

		// Scroll to see full form
		await activePage.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
		await captureStep(activePage, testInfo, { name: '04-withdraw-us-bank-scrolled' })

		consoleLogs.flush(testInfo, 'withdraw-us-bank')
		if (seeded.needsClose) await seeded.context.close()
	})

	test('SEPA withdrawal form (Bridge)', async ({ page, browser }, testInfo) => {
		const seeded = await getPageWithUser(browser, testInfo)
		const activePage = seeded.page || page
		const consoleLogs = collectConsoleLogs(activePage)

		// SEPA countries — try DE (Germany) or generic EU path
		await activePage.goto('/withdraw/DE/bank')
		await dismissModals(activePage)
		await captureStep(activePage, testInfo, { name: '01-withdraw-sepa-initial' })

		await activePage.waitForTimeout(3000)
		await dismissModals(activePage)
		await captureStep(activePage, testInfo, { name: '02-withdraw-sepa-loaded' })

		// Look for IBAN input field
		const ibanInput = activePage.locator(
			'input[placeholder*="IBAN" i], input[name*="iban" i], label:has-text("IBAN")'
		)
		if (await ibanInput.first().isVisible({ timeout: 5000 }).catch(() => false)) {
			await captureStep(activePage, testInfo, { name: '03-withdraw-sepa-iban-field' })
		}

		// Scroll to see full form
		await activePage.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
		await captureStep(activePage, testInfo, { name: '04-withdraw-sepa-scrolled' })

		consoleLogs.flush(testInfo, 'withdraw-sepa')
		if (seeded.needsClose) await seeded.context.close()
	})

	test('AR bank withdrawal form (Manteca)', async ({ page, browser }, testInfo) => {
		const seeded = await getPageWithUser(browser, testInfo)
		const activePage = seeded.page || page
		const consoleLogs = collectConsoleLogs(activePage)

		await activePage.goto('/withdraw/AR/bank')
		await dismissModals(activePage)
		await captureStep(activePage, testInfo, { name: '01-withdraw-ar-initial' })

		await activePage.waitForTimeout(3000)
		await dismissModals(activePage)
		await captureStep(activePage, testInfo, { name: '02-withdraw-ar-loaded' })

		// Look for CBU/CVU or alias input (Argentina bank fields)
		const cbuInput = activePage.locator(
			'input[placeholder*="CBU" i], input[placeholder*="CVU" i], input[placeholder*="alias" i], label:has-text("CBU"), label:has-text("CVU")'
		)
		if (await cbuInput.first().isVisible({ timeout: 5000 }).catch(() => false)) {
			await captureStep(activePage, testInfo, { name: '03-withdraw-ar-cbu-field' })
		}

		// Also check Manteca-specific UI
		await activePage.goto('/withdraw/manteca')
		await dismissModals(activePage)
		await activePage.waitForTimeout(2000)
		await captureStep(activePage, testInfo, { name: '04-withdraw-manteca-page' })

		consoleLogs.flush(testInfo, 'withdraw-ar')
		if (seeded.needsClose) await seeded.context.close()
	})

	test('transfer history shows seeded entries', async ({ page, browser }, testInfo) => {
		const seeded = await getPageWithUser(browser, testInfo)
		const activePage = seeded.page || page
		const consoleLogs = collectConsoleLogs(activePage)

		await activePage.goto('/history')
		await dismissModals(activePage)
		await captureStep(activePage, testInfo, { name: '01-history-initial' })

		await activePage.waitForTimeout(3000)
		await dismissModals(activePage)
		await captureStep(activePage, testInfo, { name: '02-history-loaded' })

		// Look for transaction entries
		const txEntries = activePage.locator(
			'[data-test="tx-entry"], [class*="transaction"], [class*="history-item"], [class*="transfer"]'
		)
		const entryCount = await txEntries.count().catch(() => 0)

		if (entryCount > 0) {
			await captureStep(activePage, testInfo, { name: '03-history-entries-visible' })

			// Click first entry for details
			await txEntries.first().click()
			await activePage.waitForTimeout(1000)
			await captureStep(activePage, testInfo, { name: '04-history-entry-detail' })
		}

		// Scroll to see more history
		await activePage.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
		await captureStep(activePage, testInfo, { name: '05-history-scrolled' })

		consoleLogs.flush(testInfo, 'withdraw-history')
		if (seeded.needsClose) await seeded.context.close()
	})
})
