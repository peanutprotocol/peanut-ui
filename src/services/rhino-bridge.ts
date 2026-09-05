'use client'

/**
 * Rhino Bridge service — non-stablecoin cross-chain outflow.
 *
 * SDA's `tokenOut` is whitelisted to USDC/USDT; cross-token withdraw
 * (USDC → ETH, etc.) routes through Rhino's standard bridge contract.
 * Direct calls to PEANUT_API_URL — no Next.js proxy in the path so this
 * works identically on web and Capacitor.
 *
 * Pairs with peanut-api-ts /rhino/bridge/* routes.
 */

import { apiFetch } from '@/utils/api-fetch'
import type { RhinoQuote } from '@/services/rhino-sda'

export interface BridgeQuoteParams {
    amount: string
    /** Source token (what the user pays). Always USDC from the Peanut wallet. */
    tokenIn: string
    /** Destination token (what the recipient gets). Cross-token if != tokenIn. */
    tokenOut: string
    chainOut: string
    recipient: string
    depositor: string
    mode: 'pay' | 'receive'
}

export interface BridgeQuoteResponse extends RhinoQuote {
    /** Backend echoes this so the FE passes it back through commit — discriminates
     *  the Rhino finalisation path (getSwapCalldata vs deposit-address). */
    isSwap: boolean
}

export interface BridgeCommitResponse {
    commitmentId: string
    calldata: {
        to: string
        data: string
        value: string
    }
    contractAddress: string | null
    kind: 'swap-calldata' | 'deposit-with-id'
}

export type BridgeStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | string

export interface BridgeStatusResponse {
    bridgeId: string
    status: BridgeStatus
    txHash?: string
    updatedAt?: string
    [key: string]: unknown
}

export interface BridgeChainConfig {
    chain: string
    tokens: string[]
    enabled: boolean
    contractAddress?: string
}

async function postJson<TReq, TRes>(path: string, body: TReq, errorLabel: string): Promise<TRes> {
    // apiFetch awaits authReady(), attaches the JWT, and sets Content-Type.
    const response = await apiFetch(path, {
        method: 'POST',
        body: JSON.stringify(body),
    })
    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`${errorLabel}: ${response.status} ${text}`)
    }
    return (await response.json()) as TRes
}

async function getJson<TRes>(path: string, errorLabel: string): Promise<TRes> {
    const response = await apiFetch(path, { method: 'GET' })
    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`${errorLabel}: ${response.status} ${text}`)
    }
    return (await response.json()) as TRes
}

export function getBridgeQuote(params: BridgeQuoteParams): Promise<BridgeQuoteResponse> {
    return postJson('/rhino/bridge/quote', params, 'Failed to get bridge quote')
}

export function commitBridgeQuote(
    quoteId: string,
    isSwap: boolean,
    isSameChainSwap: boolean
): Promise<BridgeCommitResponse> {
    return postJson('/rhino/bridge/commit', { quoteId, isSwap, isSameChainSwap }, 'Failed to commit bridge quote')
}

export function getBridgeStatus(bridgeId: string): Promise<BridgeStatusResponse> {
    return getJson(`/rhino/bridge/status/${encodeURIComponent(bridgeId)}`, 'Failed to get bridge status')
}

export function getBridgeChains(): Promise<{ chains: BridgeChainConfig[] }> {
    return getJson('/rhino/bridge/chains', 'Failed to get bridge chains')
}

/** How long signing/broadcast needs: a quote closer to expiry than this is treated as expired everywhere. */
export const QUOTE_SIGNING_LEAD_MS = 15_000

/**
 * Returns true when the quote is within the near-expiry window (default 15s).
 * Hooks should re-quote before commit to avoid Rhino rejecting an expired ID.
 */
export function isQuoteNearExpiry(expiresAt: string, leadTimeMs = QUOTE_SIGNING_LEAD_MS): boolean {
    const expires = new Date(expiresAt).getTime()
    return Number.isFinite(expires) && Date.now() + leadTimeMs >= expires
}
