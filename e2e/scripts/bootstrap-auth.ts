/**
 * One-time bootstrap: create a real Peanut account with ZeroDev kernel on Arbitrum.
 *
 * Uses Playwright + CDP virtual authenticator to walk through the real /setup flow:
 *   1. Create an invite host user via test-session (so invite code validates)
 *   2. Set invite cookie → setup skips to signup step
 *   3. Enter username → register passkey (virtual authenticator responds)
 *   4. Sign test transaction → deploys ZeroDev kernel on Arbitrum
 *   5. Save storageState for all future test runs
 *
 * Run once:  npx tsx e2e/scripts/bootstrap-auth.ts
 * Force re-run: FORCE_BOOTSTRAP=true npx tsx e2e/scripts/bootstrap-auth.ts
 */

import { chromium } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { API_BASE_URL, UI_BASE_URL, getHarnessSecret } from '../utils/env'

const BOOTSTRAP_STATE_PATH = path.resolve(__dirname, '../.auth/bootstrap-storage.json')
const BOOTSTRAP_META_PATH = path.resolve(__dirname, '../.auth/bootstrap-meta.json')
const FORCE = process.env.FORCE_BOOTSTRAP === 'true'

const TIMEOUT = {
    step: 30_000,
    kernelDeploy: 180_000,
    settle: 5_000,
}

async function ensureInviteHost(): Promise<string> {
    const hostUsername = 'e2ehost'
    console.log(`[bootstrap] Ensuring invite host user "${hostUsername}" exists...`)

    const res = await fetch(`${API_BASE_URL}/dev/test-session`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-test-harness-secret': getHarnessSecret(),
        },
        body: JSON.stringify({
            email: 'e2e-invite-host@test.local',
            username: hostUsername,
            kyc: 'verified',
            country: 'AR',
            harnessLabel: 'bootstrap-host',
        }),
    })

    if (!res.ok) {
        const body = await res.text()
        throw new Error(
            `[bootstrap] Failed to create invite host: ${res.status} ${body}\n` +
                `Make sure API is running at ${API_BASE_URL} with ENABLE_TEST_ROUTES=true`
        )
    }

    const { user } = (await res.json()) as { token: string; user: { userId: string } }
    console.log(`[bootstrap] Invite host ready: ${hostUsername} (${user.userId})`)
    return hostUsername
}

async function bootstrap() {
    if (fs.existsSync(BOOTSTRAP_STATE_PATH) && !FORCE) {
        const meta = JSON.parse(fs.readFileSync(BOOTSTRAP_META_PATH, 'utf-8'))
        console.log(`[bootstrap] Reusing existing account: ${meta.username} (${meta.userId})`)
        console.log(`[bootstrap] To force re-creation: FORCE_BOOTSTRAP=true npx tsx e2e/scripts/bootstrap-auth.ts`)
        return
    }

    console.log('[bootstrap] Creating new Peanut account with real ZeroDev kernel...')

    // Step 0: Ensure invite host exists so invite code validates
    const hostUsername = await ensureInviteHost()
    const inviteCode = `${hostUsername}INVITESYOU`

    // Username: 4-12 chars, starts with letter, lowercase alphanumeric only
    const suffix = crypto.randomBytes(2).toString('hex') // 4 hex chars
    const username = `e2e${suffix}` // 7 chars total — well within limit
    console.log(`[bootstrap] Username: ${username}, invite code: ${inviteCode}`)

    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent:
            'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
        isMobile: true,
        hasTouch: true,
    })

    // Set invite code cookie BEFORE navigating — setup page reads it on mount
    // and skips directly to the signup step.
    // Cookie values are stored JSON-stringified + URI-encoded by saveToCookie/getFromCookie
    const encodedInviteCode = encodeURIComponent(JSON.stringify(inviteCode))
    await context.addCookies([
        {
            name: 'inviteCode',
            value: encodedInviteCode,
            domain: new URL(UI_BASE_URL).hostname,
            path: '/',
            httpOnly: false,
            secure: false,
            sameSite: 'Lax',
        },
    ])

    const page = await context.newPage()

    // Enable CDP and add virtual authenticator
    const cdp = await context.newCDPSession(page)
    await cdp.send('WebAuthn.enable')
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
        options: {
            protocol: 'ctap2',
            transport: 'internal',
            hasResidentKey: true,
            hasUserVerification: true,
            isUserVerified: true,
        },
    })
    console.log(`[bootstrap] Virtual authenticator ready (${authenticatorId})`)

    // Capture ALL console for debugging
    page.on('console', (msg) => {
        const text = msg.text()
        // Log everything during bootstrap — helps debug passkey issues
        if (msg.type() === 'error' || msg.type() === 'warning') {
            console.log(`  [ui:${msg.type()}] ${text}`)
        } else if (
            text.includes('[') || // tagged logs
            text.includes('passkey') ||
            text.includes('Passkey') ||
            text.includes('WebAuthn') ||
            text.includes('webauthn') ||
            text.includes('Error') ||
            text.includes('error')
        ) {
            console.log(`  [ui] ${text}`)
        }
    })

    page.on('pageerror', (err) => {
        console.error(`  [page-error] ${err.message}`)
    })

    // Monitor network for passkey API calls
    page.on('response', (response) => {
        const url = response.url()
        if (url.includes('passkey') || url.includes('register') || url.includes('login')) {
            console.log(`  [net] ${response.status()} ${response.request().method()} ${url}`)
        }
    })

    // Force P-256 (ES256, alg -7) for WebAuthn — ZeroDev's smart wallet validator
    // requires P-256 keys, but the virtual authenticator defaults to Ed25519 when
    // the server's pubKeyCredParams lists EdDSA (-8) first.
    await page.addInitScript(() => {
        const origCreate = navigator.credentials.create.bind(navigator.credentials)
        navigator.credentials.create = async (options?: CredentialCreationOptions) => {
            if (options?.publicKey?.pubKeyCredParams) {
                // Keep only ES256 (P-256, alg -7)
                options.publicKey.pubKeyCredParams = options.publicKey.pubKeyCredParams.filter((p) => p.alg === -7)
                if (options.publicKey.pubKeyCredParams.length === 0) {
                    // Fallback: explicitly add ES256
                    options.publicKey.pubKeyCredParams = [{ type: 'public-key', alg: -7 }]
                }
                console.log('[bootstrap-intercept] Forced pubKeyCredParams to ES256 (P-256)')
            }
            const cred = await origCreate(options)
            if (cred && 'response' in cred) {
                const pkCred = cred as PublicKeyCredential
                const response = pkCred.response as AuthenticatorAttestationResponse
                console.log(
                    '[bootstrap-intercept] credential created:',
                    JSON.stringify({
                        publicKeyLength: response.getPublicKey?.()?.byteLength ?? null,
                    })
                )
            }
            return cred
        }
    })

    try {
        // Step 1: Navigate to /setup — invite cookie makes it skip to signup
        console.log('[bootstrap] Navigating to /setup (invite cookie set, should skip to signup)...')
        await page.goto(`${UI_BASE_URL}/setup`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT.step })
        await page.waitForTimeout(4000)

        // Take a screenshot to see where we landed
        await page.screenshot({
            path: path.resolve(__dirname, '../.auth/bootstrap-debug-01-after-setup.png'),
        })

        // Dismiss any modals that appear before the signup form
        for (let i = 0; i < 5; i++) {
            const gotItBtn = page.locator('button:has-text("Got it!")')
            if (await gotItBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
                await gotItBtn.click()
                console.log('[bootstrap] Dismissed "Got it!" modal')
                await page.waitForTimeout(1000)
                continue
            }
            break
        }

        // Step 2: Enter username on Signup screen
        const usernameInput = page.locator('input[placeholder="Enter a username"]')
        await usernameInput.waitFor({ state: 'visible', timeout: TIMEOUT.step })
        console.log(`[bootstrap] On signup screen. Entering username: ${username}`)
        await usernameInput.fill(username)

        // Wait for debounced validation (750ms debounce + API call)
        await page.waitForTimeout(2500)

        const nextBtn = page.locator('button:has-text("Next")')
        // Wait for Next button to be enabled (validation passed)
        await page.waitForFunction(
            () => {
                const buttons = document.querySelectorAll('button')
                for (const b of buttons) {
                    if (b.textContent?.includes('Next') && !b.disabled) return true
                }
                return false
            },
            { timeout: TIMEOUT.step }
        )
        console.log('[bootstrap] Username validated, clicking Next...')
        await nextBtn.click()
        await page.waitForTimeout(2000)

        // Step 3: SetupPasskey — click "Set it up"
        const setupBtn = page.locator('button:has-text("Set it up")')
        await setupBtn.waitFor({ state: 'visible', timeout: TIMEOUT.step })
        console.log('[bootstrap] Clicking "Set it up" (passkey registration via virtual authenticator)...')
        await setupBtn.click()

        // Wait for: WebAuthn create → API /passkeys/register/verify → JWT cookie set → kernel client init → address
        console.log('[bootstrap] Waiting for passkey registration + kernel client init...')

        // The "Confirm & finish" button appears after kernel client is ready AND user data loads
        const confirmBtn = page.locator('button:has-text("Confirm & finish"), button:has-text("Confirm")')
        await confirmBtn.waitFor({ state: 'visible', timeout: TIMEOUT.kernelDeploy })
        console.log('[bootstrap] Kernel client ready. Waiting for "Confirm & finish" to be enabled...')

        await page.waitForFunction(
            () => {
                const buttons = document.querySelectorAll('button')
                for (const b of buttons) {
                    if ((b.textContent?.includes('Confirm') || b.textContent?.includes('finish')) && !b.disabled)
                        return true
                }
                return false
            },
            { timeout: TIMEOUT.kernelDeploy }
        )

        await page.screenshot({
            path: path.resolve(__dirname, '../.auth/bootstrap-debug-02-before-confirm.png'),
        })

        console.log('[bootstrap] Clicking "Confirm & finish" (deploys kernel on Arbitrum)...')
        await confirmBtn.click()

        // Wait for kernel deployment + test tx + account creation + redirect to /home
        console.log('[bootstrap] Waiting for kernel deployment and redirect to /home...')
        await page.waitForURL('**/home**', { timeout: TIMEOUT.kernelDeploy })
        console.log(`[bootstrap] Redirected to: ${page.url()}`)

        // Dismiss any post-signup modals
        await page.waitForTimeout(3000)
        for (let i = 0; i < 5; i++) {
            const closeBtn = page.locator(
                'button:has-text("Got it!"), button:has-text("Skip"), button[aria-label="Close"]'
            )
            if (
                await closeBtn
                    .first()
                    .isVisible({ timeout: 1_500 })
                    .catch(() => false)
            ) {
                await closeBtn.first().click()
                console.log(`[bootstrap] Dismissed post-signup modal`)
                await page.waitForTimeout(1000)
            } else {
                break
            }
        }

        // Use test-session to ensure has_app_access=true (invite flow may leave in waitlist)
        const cookies = await context.cookies()
        const jwtCookie = cookies.find((c) => c.name === 'jwt-token')
        if (!jwtCookie) {
            throw new Error('JWT cookie not found after signup')
        }

        const payload = JSON.parse(Buffer.from(jwtCookie.value.split('.')[1], 'base64url').toString())
        const userId = payload.userId

        // Fix: passkey signup creates users with empty email, and /invites/accept
        // fails with CORS in dev (localhost:3000 → 127.0.0.1:5000), leaving
        // has_app_access=false. Call test-session with the userId so it finds the
        // existing user (even without email match) and sets is_active + has_app_access.
        const fixRes = await fetch(`${API_BASE_URL}/dev/test-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-test-harness-secret': getHarnessSecret(),
            },
            body: JSON.stringify({
                email: `${username}@e2e-bootstrap.local`,
                userId, // test-session now looks up by userId if email lookup fails
                kyc: 'verified',
                country: 'AR',
                harnessLabel: 'bootstrap',
            }),
        })
        if (fixRes.ok) {
            console.log('[bootstrap] User flags fixed (is_active=true, has_app_access=true)')
        } else {
            console.warn(`[bootstrap] WARNING: test-session fixup returned ${fixRes.status}`)
        }

        // Re-navigate to /home to verify the user has app access
        await page.goto(`${UI_BASE_URL}/home`, { waitUntil: 'domcontentloaded', timeout: 15_000 })
        await page.waitForTimeout(3000)

        const onWaitlist = await page
            .locator('text=/stay in the loop/i, text=/waitlist/i')
            .first()
            .isVisible({ timeout: 2_000 })
            .catch(() => false)
        if (onWaitlist) {
            throw new Error('Bootstrap user is stuck on waitlist — has_app_access is still false')
        }
        console.log('[bootstrap] Home page loaded — user has app access')

        // Save storageState
        await context.storageState({ path: BOOTSTRAP_STATE_PATH })
        console.log(`[bootstrap] Storage state saved to ${BOOTSTRAP_STATE_PATH}`)

        // Save metadata
        const meta = {
            username,
            userId,
            inviteCode,
            createdAt: new Date().toISOString(),
            url: page.url(),
        }
        fs.writeFileSync(BOOTSTRAP_META_PATH, JSON.stringify(meta, null, 2))
        console.log(`[bootstrap] Meta saved: ${JSON.stringify(meta)}`)

        // Save virtual authenticator credentials for debugging
        const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId })
        if (credentials.length > 0) {
            const credPath = path.resolve(__dirname, '../.auth/bootstrap-credentials.json')
            fs.writeFileSync(credPath, JSON.stringify(credentials, null, 2))
            console.log(`[bootstrap] Saved ${credentials.length} WebAuthn credential(s)`)
        }

        console.log('\n[bootstrap] Done! Account ready for e2e tests.')
        console.log(`  Username: ${username}`)
        console.log(`  UserId:   ${userId}`)
    } catch (error) {
        const screenshotPath = path.resolve(__dirname, '../.auth/bootstrap-failure.png')
        await page.screenshot({ path: screenshotPath, fullPage: true })
        console.error(`[bootstrap] Failed. Screenshot saved to ${screenshotPath}`)
        console.error(`[bootstrap] Current URL: ${page.url()}`)

        // Dump page content for debugging
        const html = await page.content()
        fs.writeFileSync(path.resolve(__dirname, '../.auth/bootstrap-failure.html'), html)

        console.error(error)
        process.exitCode = 1
    } finally {
        await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId })
        await browser.close()
    }
}

bootstrap()
