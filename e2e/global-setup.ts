/**
 * Playwright global setup: load bootstrap account or fall back to test-session.
 *
 * Priority:
 *   1. If bootstrap-storage.json exists (from bootstrap-auth.ts), use it.
 *      This has a real ZeroDev kernel + passkey, so authenticated flows work.
 *   2. Otherwise, fall back to /dev/test-session (synthetic JWT, no kernel).
 *      Good enough for public routes and basic UI snapshots.
 *
 * Run bootstrap first:
 *   npx tsx e2e/scripts/bootstrap-auth.ts
 */

import { chromium } from '@playwright/test'
import type { FullConfig } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { createAllPersonas } from './utils/personas'

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000'
const UI_BASE = process.env.UI_BASE_URL || 'http://localhost:3000'
const HARNESS_SECRET = process.env.TEST_HARNESS_SECRET || 'local-harness-secret-long-enough-32ch'

const BOOTSTRAP_STATE = path.resolve(__dirname, '.auth/bootstrap-storage.json')
const BOOTSTRAP_META = path.resolve(__dirname, '.auth/bootstrap-meta.json')
const STORAGE_STATE = path.resolve(__dirname, '.auth/storage-state.json')

export default async function globalSetup(config: FullConfig) {
	// Strategy 1: Bootstrap account (real ZeroDev kernel)
	if (fs.existsSync(BOOTSTRAP_STATE) && fs.existsSync(BOOTSTRAP_META)) {
		const meta = JSON.parse(fs.readFileSync(BOOTSTRAP_META, 'utf-8'))
		console.log(`[global-setup] Using bootstrap account: ${meta.username} (${meta.userId})`)

		// Validate the JWT hasn't expired
		const state = JSON.parse(fs.readFileSync(BOOTSTRAP_STATE, 'utf-8'))
		const jwtCookie = state.cookies?.find((c: any) => c.name === 'jwt-token')
		if (jwtCookie) {
			try {
				const payload = JSON.parse(Buffer.from(jwtCookie.value.split('.')[1], 'base64url').toString())
				const expiresAt = payload.exp * 1000
				if (expiresAt < Date.now()) {
					console.warn('[global-setup] Bootstrap JWT expired — falling back to test-session')
				} else {
					fs.copyFileSync(BOOTSTRAP_STATE, STORAGE_STATE)
					process.env.TEST_USER_ID = meta.userId
					process.env.TEST_USER_USERNAME = meta.username
					console.log(`[global-setup] Bootstrap state copied. JWT valid until ${new Date(expiresAt).toISOString()}`)

					// Ensure bootstrap user exists in DB. Integration tests truncate the DB
					// and would otherwise orphan the bootstrap JWT.
					try {
						const reviveRes = await fetch(`${API_BASE}/dev/test-session`, {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
								'x-test-harness-secret': HARNESS_SECRET,
							},
							body: JSON.stringify({
								email: `bootstrap-${meta.userId}@test.local`,
								userId: meta.userId,
								kyc: 'verified',
								country: 'AR',
								harnessLabel: 'bootstrap-revive',
							}),
						})
						if (reviveRes.ok) {
							console.log(`[global-setup] Bootstrap user ensured in DB (KYC verified, AR)`)
						}
					} catch (e) {
						console.warn(`[global-setup] Could not revive bootstrap user: ${(e as Error).message}`)
					}

					// Create test personas (non-fatal — tests fall back to default)
					try {
						await createAllPersonas(jwtCookie.value, meta.userId, meta.username)
					} catch (e) {
						console.warn(`[global-setup] Persona creation failed: ${(e as Error).message}`)
					}
					return
				}
			} catch {
				console.warn('[global-setup] Could not parse bootstrap JWT — falling back')
			}
		}
	}

	// Strategy 2: Synthetic test-session (no ZeroDev kernel, but fast)
	console.log('[global-setup] No bootstrap found, using /dev/test-session...')
	const testEmail = process.env.TEST_USER_EMAIL || `harness-e2e-${Date.now()}@test.local`

	const res = await fetch(`${API_BASE}/dev/test-session`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-test-harness-secret': HARNESS_SECRET,
		},
		body: JSON.stringify({
			email: testEmail,
			kyc: 'verified',
			country: 'AR',
			harnessLabel: 'playwright',
		}),
	})

	if (!res.ok) {
		const body = await res.text()
		throw new Error(
			`[global-setup] /dev/test-session returned ${res.status}: ${body}\n` +
				`Make sure the API is running at ${API_BASE} with ENABLE_TEST_ROUTES=true and TEST_HARNESS_SECRET set.`
		)
	}

	const { token, user } = (await res.json()) as { token: string; user: { userId: string; email: string } }
	console.log(`[global-setup] Authenticated as ${user.email} (${user.userId})`)

	const browser = await chromium.launch()
	const context = await browser.newContext()

	await context.addCookies([
		{
			name: 'jwt-token',
			value: token,
			domain: new URL(UI_BASE).hostname,
			path: '/',
			httpOnly: false,
			secure: false,
			sameSite: 'Lax',
		},
	])

	const page = await context.newPage()
	try {
		await page.goto(`${UI_BASE}/home`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
		await page.waitForTimeout(3000)

		for (let attempt = 0; attempt < 5; attempt++) {
			const gotIt = page.locator('button:has-text("Got it!")')
			if (await gotIt.isVisible({ timeout: 2_000 }).catch(() => false)) {
				await gotIt.click()
				console.log(`[global-setup] Dismissed "Got it!" modal`)
				await page.waitForTimeout(1000)
				continue
			}

			const skip = page.locator('button:has-text("Skip"), text=Skip')
			if (await skip.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
				await skip.first().click()
				console.log(`[global-setup] Dismissed PWA install screen`)
				await page.waitForTimeout(1000)
				continue
			}

			const closeBtn = page.locator(
				'button[aria-label="Close"], button:has-text("×"), dialog button:has-text("Close")'
			)
			if (await closeBtn.first().isVisible({ timeout: 1_000 }).catch(() => false)) {
				await closeBtn.first().click()
				console.log(`[global-setup] Dismissed modal via close button`)
				await page.waitForTimeout(1000)
				continue
			}

			break
		}

		if (page.url().includes('/setup')) {
			console.log('[global-setup] Still on setup — navigating to /home')
			await page.goto(`${UI_BASE}/home`, { waitUntil: 'domcontentloaded', timeout: 15_000 })
			await page.waitForTimeout(3000)
		}

		console.log(`[global-setup] Final URL: ${page.url()}`)
	} catch (e) {
		console.warn(`[global-setup] Warning: ${(e as Error).message}`)
	}

	await context.storageState({ path: STORAGE_STATE })
	console.log('[global-setup] Storage state saved')

	await browser.close()

	process.env.TEST_USER_ID = user.userId
	process.env.TEST_USER_EMAIL = user.email

	// Create test personas (non-fatal — tests fall back to default)
	try {
		await createAllPersonas(token, user.userId, user.email)
	} catch (e) {
		console.warn(`[global-setup] Persona creation failed: ${(e as Error).message}`)
	}
}
