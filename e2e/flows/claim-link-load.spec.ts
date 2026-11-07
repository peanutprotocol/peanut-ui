/**
 * Claim-link loading with the link-key proof (TASK-24599).
 *
 * A guest opens a claim link. The app derives the link key from the `#p=`
 * password and signs a read proof, which the API needs before it shows the
 * note and the people on the link (peanut-api-ts src/routes/send-links/read-proof.ts).
 *
 * The API here is a stand-in that behaves like the real one with
 * SEND_LINK_PROOF_ENFORCE on: it verifies the proof with its own copy of the
 * message format and answers the full link only to a valid proof, else the
 * preview. So a green run proves the built app signs what the API verifies,
 * and that the claim page renders from it. Every other cross-origin request is
 * answered locally, so the browser never reaches a real backend.
 *
 * The real backend, chain and providers are the Nutcracker harness's job.
 */

import { test, expect, type Page } from '@playwright/test'
import { keccak256, recoverMessageAddress, toBytes, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const CHAIN_ID = '42161'
const USDC_ARBITRUM = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
const MAX_PROOF_AGE_SECONDS = 600

function linkFor(password: string, depositIdx: number) {
    const pubKey = privateKeyToAccount(keccak256(toBytes(password))).address
    return { pubKey, url: `/claim?c=${CHAIN_ID}&v=v4.3&i=${depositIdx}#p=${password}` }
}

type ReadRequest = { url: string; proof: string | null; proofValid: boolean; headers: Record<string, string> }

/** The API's check, written out again so a shared bug cannot pass both sides. */
async function proofIsValid(pubKey: string, proof: string | null): Promise<boolean> {
    const match = proof?.match(/^(\d{1,12})\.(0x[0-9a-fA-F]{130})$/)
    if (!match) return false
    const seconds = Number(match[1])
    if (Math.abs(Math.floor(Date.now() / 1000) - seconds) > MAX_PROOF_AGE_SECONDS) return false
    const signer = await recoverMessageAddress({
        message: `peanut-send-link-read:${pubKey.toLowerCase()}:${CHAIN_ID}:${seconds}`,
        signature: match[2] as Hex,
    })
    return signer.toLowerCase() === pubKey.toLowerCase()
}

const bigint = (value: bigint) => ({ '@type': 'BigInt', value: value.toString() })

function fullLink(pubKey: string, depositIdx: number, overrides: Record<string, unknown> = {}) {
    return {
        pubKey,
        depositIdx,
        chainId: CHAIN_ID,
        contractVersion: 'v4.3',
        textContent: 'Lunch money, thanks!',
        fileUrl: null,
        status: 'completed',
        createdAt: '2026-11-07T10:00:00.000Z',
        cancelledAt: null,
        senderAddress: '0x' + '11'.repeat(20),
        amount: bigint(5_000_000n),
        tokenAddress: USDC_ARBITRUM,
        createTransactionHash: null,
        claimFailureCode: null,
        sender: { userId: 'e2e-sender', username: 'proofsender', fullName: null, showFullName: false, accounts: [] },
        claim: null,
        events: [],
        ...overrides,
    }
}

/** What the API sends an unproven caller once enforcement is on. */
function preview(link: ReturnType<typeof fullLink>) {
    const { pubKey, chainId, depositIdx, contractVersion, status, amount, tokenAddress, senderAddress } = link
    return {
        pubKey,
        chainId,
        depositIdx,
        contractVersion,
        status,
        amount,
        tokenAddress,
        senderAddress,
        sender: { username: link.sender.username },
    }
}

/**
 * Serve `link` (or a 404 when null) for GET /send-links/:pubKey, record every
 * read, and answer all other cross-origin traffic locally.
 */
async function standInApi(
    page: Page,
    baseURL: string | undefined,
    pubKey: string,
    link: ReturnType<typeof fullLink> | null
) {
    const reads: ReadRequest[] = []
    const appOrigin = new URL(baseURL!).origin
    await page.route(
        (url) => url.origin !== appOrigin,
        async (route) => {
            const url = new URL(route.request().url())
            const read = url.pathname.match(/^\/send-links\/(0x[0-9a-fA-F]{40})(\/status)?$/)
            if (!read) {
                // Analytics, error reporting, the session check: nothing the claim page needs.
                return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
            }
            const proof = url.searchParams.get('proof')
            const proofValid = await proofIsValid(read[1], proof)
            reads.push({ url: url.toString(), proof, proofValid, headers: route.request().headers() })
            if (!link || read[1].toLowerCase() !== pubKey.toLowerCase()) {
                return route.fulfill({
                    status: 404,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Send link not found' }),
                })
            }
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(proofValid ? link : preview(link)),
            })
        }
    )
    return reads
}

function expectNoSecretSent(reads: ReadRequest[], password: string) {
    for (const read of reads) {
        expect(read.url).not.toContain(password)
        expect(JSON.stringify(read.headers)).not.toContain(password)
    }
}

test.describe('Claim link loading (TASK-24599)', () => {
    test('a guest sees the amount, the sender and the note, read with a valid proof', async ({ page, baseURL }) => {
        const password = 'e2eProofOpenLink01'
        const { pubKey, url } = linkFor(password, 71001)
        const reads = await standInApi(page, baseURL, pubKey, fullLink(pubKey, 71001))

        await page.goto(url)

        await expect(page.getByText('Lunch money, thanks!')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('proofsender').first()).toBeVisible()
        await expect(page.getByText(/\b5(\.00)?\b/).first()).toBeVisible()

        expect(reads.length).toBeGreaterThan(0)
        expect(reads[0].url).toContain(`/send-links/${pubKey}?`)
        expect(reads[0].proof, 'the link read carries a proof').toMatch(/^\d+\.0x[0-9a-f]{130}$/i)
        expect(
            reads.every((r) => r.proofValid),
            'every proof verifies against the link pubKey'
        ).toBe(true)
        expectNoSecretSent(reads, password)
    })

    test('an already-claimed link shows that it is no longer available', async ({ page, baseURL }) => {
        const password = 'e2eProofClaimedLink02'
        const { pubKey, url } = linkFor(password, 71002)
        const claimed = fullLink(pubKey, 71002, {
            status: 'CLAIMED',
            claim: {
                amount: '5000000',
                tokenAddress: USDC_ARBITRUM,
                txHash: '0x' + 'ab'.repeat(32),
                recipientAddress: '0x' + '33'.repeat(20),
                recipient: null,
            },
            events: [{ status: 'CLAIMED', timestamp: '2026-11-07T10:05:00.000Z', reason: null }],
        })
        const reads = await standInApi(page, baseURL, pubKey, claimed)

        await page.goto(url)

        await expect(page.getByText('Link no longer available')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('proofsender').first()).toBeVisible()
        expect(reads[0].proofValid).toBe(true)
        expectNoSecretSent(reads, password)
    })

    test('an unknown link ends on the broken-link screen, still sending a proof', async ({ page, baseURL }) => {
        const password = 'e2eProofMissingLink03'
        const { pubKey, url } = linkFor(password, 71003)
        const reads = await standInApi(page, baseURL, pubKey, null)

        await page.goto(url)

        // The page retries a 404 four times (about 15 s) in case the link was just created.
        await expect(page.getByText('This link seems broken!')).toBeVisible({ timeout: 45_000 })
        expect(reads.length).toBeGreaterThan(0)
        expect(reads.every((r) => r.proofValid)).toBe(true)
        expectNoSecretSent(reads, password)
    })

    test('a link whose password does not match shows the wrong-password screen', async ({ page, baseURL }) => {
        const password = 'e2eProofWrongPassword04'
        const { pubKey, url } = linkFor(password, 71004)
        // The API knows this slot under another key, as when the fragment was mangled.
        const other = linkFor('someone-elses-password', 71004).pubKey
        await standInApi(page, baseURL, pubKey, { ...fullLink(pubKey, 71004), pubKey: other })

        await page.goto(url)

        await expect(page.getByText('Wrong password!')).toBeVisible({ timeout: 30_000 })
    })
})
