/**
 * Send-link + claim + refund regression guard.
 *
 * Protects the AppKit-removal + useCreateLink / useClaimLink cleanup in the
 * decomplexify sprint. Pure UI-level checks, so they need no API and no login:
 * `?__fixture=home` supplies a fake session and fake API answers, or the app
 * layout holds every screen on the loading mascot and the checks prove nothing.
 * See src/dev/fixtures/active.ts.
 *
 * The full flow — spend USDC on-chain, then assert the DB writes — belongs in
 * Nutcracker scenarios, not here.
 */

import { test, expect } from '@playwright/test'

test.describe('Send-link / claim / refund regression', () => {
    test('claim page for an invalid link renders without a wagmi-context crash', async ({ page }) => {
        // Guards: after dropping `useAccount` + `useSwitchChain` from useClaimLink,
        // the page should render for any link (even garbage) instead of throwing
        // a missing-wagmi-provider error during hydration.
        const errors: string[] = []
        page.on('console', (msg) => {
            if (msg.type() === 'error') errors.push(msg.text())
        })
        page.on('pageerror', (err) => errors.push(err.message))

        await page.goto('/claim?c=deadbeef&v=v4&i=0&p=bogus&__fixture=home', { waitUntil: 'domcontentloaded' })
        await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})

        const body = await page.locator('body').innerText()
        expect(body.length, 'claim page should render some body content').toBeGreaterThan(0)

        const wagmiErrors = errors.filter((e) =>
            /WagmiContext|useAccount must be used|useSwitchChain must be used|WagmiProvider/.test(e)
        )
        expect(wagmiErrors, `missing wagmi provider errors on /claim: ${JSON.stringify(wagmiErrors)}`).toEqual([])
    })

    test('/refund no longer renders the old external-wallet refund UI', async ({ page }) => {
        // The Refund component + /refund page were BYOW-only and got removed.
        // The route might be 404'd by Next.js or fall through to the app's catch-all
        // — both acceptable. What's NOT acceptable: the old UI still renders.
        await page.goto('/refund?__fixture=home', { waitUntil: 'domcontentloaded' })
        const body = await page
            .locator('body')
            .innerText()
            .catch(() => '')

        // Old Refund UI's Card.Description had this very specific sentence.
        const oldRefundPhrase = /you will have to be connected with the same wallet/i
        expect(oldRefundPhrase.test(body), '/refund must not render the old external-wallet refund UI').toBe(false)

        // Also: there shouldn't be a visible 'Transaction hash' + 'Chain' form (the
        // old two-field Refund form).
        const refundFormFingerprint = /transaction hash/i.test(body) && /chain/i.test(body)
        expect(refundFormFingerprint, '/refund must not render the old refund form').toBe(false)
    })

    test('send-link page renders without a wagmi provider error', async ({ page }) => {
        // useCreateLink used to call useSignTypedData (wagmi) — that's gone now.
        // Load the send page and confirm no wagmi provider errors fire during hydration.
        const errors: string[] = []
        page.on('console', (msg) => {
            if (msg.type() === 'error') errors.push(msg.text())
        })
        page.on('pageerror', (err) => errors.push(err.message))

        await page.goto('/send?view=link&__fixture=home', { waitUntil: 'domcontentloaded' })
        await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})

        const wagmiErrors = errors.filter((e) => /useSignTypedData must be used|WagmiContext|WagmiProvider/.test(e))
        expect(wagmiErrors, `missing wagmi provider errors on /send: ${JSON.stringify(wagmiErrors)}`).toEqual([])
    })
})
