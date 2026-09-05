'use client'

/**
 * Client-side wrappers around the unified Rhino SDA-transfer backend.
 *
 * Direct calls to PEANUT_API_URL — no Next.js proxy in the path so this
 * works identically on web (CORS-allowed origin) and native (no Next.js
 * server exists). JWT forwarded for the backend's verifyAuth preHandler.
 *
 * Three consumers: withdraw, pay-request-x-chain, claim-link-x-chain.
 */

import { apiFetch } from '@/utils/api-fetch'
import type { Address } from 'viem'

export type RhinoTransferContext = 'withdraw' | 'pay-request' | 'claim-xchain'
/**
 * Token symbol passed to the Rhino backend. Plain string — Rhino validates
 * against the (chainIn, chainOut) pair. The legacy `'USDC' | 'USDT'`
 * restriction was an artificial FE limit that blocked cross-token withdraw.
 */
export type RhinoSupportedToken = string

export interface SdaTransferRequest {
    context: RhinoTransferContext
    /** Charge uuid for withdraw+pay-request, claim pubKey for claim-xchain. */
    contextId: string
    /** Rhino chain name (e.g. ARBITRUM, BASE). */
    depositChain: string
    destinationChain: string
    /** 0x for EVM destinations, base58 for Solana/Tron — the BE forwards it
     *  to Rhino, which validates per destination chain. */
    destinationAddress: string
    tokenOut: RhinoSupportedToken
    senderPeanutWalletAddress?: Address
    /**
     * Rhino quote economics from the immediately-preceding /preview, echoed so
     * the backend persists them onto the charge intent and books the bridge
     * FEE ledger entry at settlement. Omitted for claim-xchain (no charge).
     * `payAmount`/`receiveAmount` are destination-token decimal strings.
     */
    feeUsd?: number
    payAmount?: string
    receiveAmount?: string
    /**
     * Deposit identity for claim-xchain, so the backend can read the claim
     * amount from chain (authoritative, immutable) and reject a sub-minimum
     * bridge that Rhino would park without auto-refund. Omitted for
     * withdraw/pay-request, whose amount the backend derives from the charge.
     */
    depositChainId?: string
    depositIdx?: number
    depositContractVersion?: string
}

export interface SdaTransferResult {
    sdaAddress: Address
    depositChain: string
    destinationChain: string
    destinationAddress: Address
    tokenOut: string
    minDepositLimitUsd: number
    maxDepositLimitUsd: number
}

export interface SdaPreviewRequest {
    chainIn: string
    chainOut: string
    token: RhinoSupportedToken
    amount: string // decimal
    mode: 'pay' | 'receive'
    /** The kernel wallet that will deposit. The quote is account- and
     *  address-bound (Rhino's authenticated quote), so both are required. */
    depositor: string
    /** Where Rhino delivers on `chainOut` — 0x, base58 or TRC20 per chain. */
    recipient: string
}

/**
 * The one normalized Rhino quote, as returned by both
 * `/rhino/sda-transfer/preview` and `/rhino/bridge/quote`. `feeUsd` is
 * Rhino's TOTAL fee and equals `payAmount − receiveAmount` in USD; the
 * components are for audit only. Consumers show these numbers verbatim —
 * never add the components on top, never derive a fee from the amounts.
 */
export interface RhinoQuote {
    /** Decimal string in `tokenIn` units — the USDC the kernel deposits. */
    payAmount: string
    payAmountUsd: number
    /** Decimal string in `tokenOut` units — what the recipient gets (USDC on
     *  the SDA path, ETH etc. on a cross-token bridge). */
    receiveAmount: string
    receiveAmountUsd: number
    feeUsd: number
    fees: {
        gasUsd: number
        sourceGasUsd: number
        platformUsd: number
        percentageUsd: number
    }
    quoteId: string
    expiresAt: string // ISO timestamp
    estimatedDuration?: number
}

async function postRhino<TReq, TRes>(path: string, body: TReq, errorLabel: string): Promise<TRes> {
    // apiFetch awaits authReady(), attaches the JWT, and sets Content-Type.
    const response = await apiFetch(path, {
        method: 'POST',
        body: JSON.stringify(body),
    })
    if (!response.ok) {
        const text = await response.text().catch(() => '')
        // Surface the backend's own message (and wire `code`) verbatim so callers
        // can show it directly — e.g. the sub-minimum rejection ("Amount ($2.00)
        // is below the $5 minimum to bridge to ETHEREUM.") reaches the confirm
        // view instead of a `${errorLabel}: 400 {json}` blob. Falls back to the
        // labelled status line for a non-JSON or empty body.
        let message = `${errorLabel}: ${response.status} ${text}`
        let code: string | undefined
        try {
            const parsed = JSON.parse(text) as { error?: unknown; message?: unknown; code?: unknown }
            if (typeof parsed.error === 'string' && parsed.error) message = parsed.error
            else if (typeof parsed.message === 'string' && parsed.message) message = parsed.message
            if (typeof parsed.code === 'string' && parsed.code) code = parsed.code
        } catch {
            // non-JSON body — keep the labelled fallback message
        }
        const error = new Error(message) as Error & { status?: number; code?: string }
        error.status = response.status
        if (code) error.code = code
        throw error
    }
    return (await response.json()) as TRes
}

export async function provisionSdaTransfer(body: SdaTransferRequest): Promise<SdaTransferResult> {
    return postRhino('/rhino/sda-transfer', body, 'Failed to provision SDA transfer')
}

export async function previewSdaTransfer(body: SdaPreviewRequest): Promise<RhinoQuote> {
    return postRhino('/rhino/sda-transfer/preview', body, 'Failed to preview SDA transfer')
}
