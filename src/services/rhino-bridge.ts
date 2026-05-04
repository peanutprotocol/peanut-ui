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

import { PEANUT_API_URL } from '@/constants/general.consts'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { getAuthHeaders } from '@/utils/auth-token'

export interface BridgeQuoteParams {
    amount: string
    token: string
    chainOut: string
    recipient: string
    depositor: string
    mode: 'pay' | 'receive'
}

export interface BridgeQuoteResponse {
    quoteId: string
    amountIn: string
    amountOut: string
    fee: string
    feeUsd: number
    gasFeeUsd: number
    estimatedDuration?: number
    expiresAt: string // ISO timestamp
}

export interface BridgeCommitResponse {
    commitmentId: string
    calldata: {
        to: string
        data: string
        value: string
    }
    contractAddress: string | null
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
    const response = await fetchWithSentry(`${PEANUT_API_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
    })
    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`${errorLabel}: ${response.status} ${text}`)
    }
    return (await response.json()) as TRes
}

async function getJson<TRes>(path: string, errorLabel: string): Promise<TRes> {
    const response = await fetchWithSentry(`${PEANUT_API_URL}${path}`, {
        method: 'GET',
        headers: getAuthHeaders(),
    })
    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`${errorLabel}: ${response.status} ${text}`)
    }
    return (await response.json()) as TRes
}

export function getBridgeQuote(params: BridgeQuoteParams): Promise<BridgeQuoteResponse> {
    return postJson('/rhino/bridge/quote', params, 'Failed to get bridge quote')
}

export function commitBridgeQuote(quoteId: string): Promise<BridgeCommitResponse> {
    return postJson('/rhino/bridge/commit', { quoteId }, 'Failed to commit bridge quote')
}

export function getBridgeStatus(bridgeId: string): Promise<BridgeStatusResponse> {
    return getJson(`/rhino/bridge/status/${encodeURIComponent(bridgeId)}`, 'Failed to get bridge status')
}

export function getBridgeChains(): Promise<{ chains: BridgeChainConfig[] }> {
    return getJson('/rhino/bridge/chains', 'Failed to get bridge chains')
}

/**
 * Returns true when the quote is within the near-expiry window (default 15s).
 * Hooks should re-quote before commit to avoid Rhino rejecting an expired ID.
 */
export function isQuoteNearExpiry(expiresAt: string, leadTimeMs = 15_000): boolean {
    const expires = new Date(expiresAt).getTime()
    return Number.isFinite(expires) && Date.now() + leadTimeMs >= expires
}
