/**
 * Rhino Bridge service — cross-chain withdrawal via Rhino backend.
 *
 * This is a plain client-side service (NOT a Next.js server action).
 * Uses fetchWithSentry for API calls, same pattern as other services.
 */

import { PEANUT_API_URL } from '@/constants/general.consts'
import { fetchWithSentry } from '@/utils/sentry.utils'
import Cookies from 'js-cookie'

// ─── Request / Response Types ───────────────────────────────────────────────

export interface RhinoWithdrawQuoteParams {
    amount: string
    token: string
    chainOut: string
    recipient: string
    /** 'pay'    → amount is what user sends (from amount)
     *  'receive' → amount is what recipient gets (to amount) */
    mode: 'pay' | 'receive'
}

export interface RhinoQuoteResponse {
    quoteId: string
    amountIn: string
    amountOut: string
    fee: string
    feeUsd: number
    gasFeeUsd: number
    estimatedDuration: number // seconds
    expiresAt: string // ISO timestamp
}

export interface RhinoCommitResponse {
    commitmentId: string
    calldata: {
        to: string
        data: string
        value: string
    }
    contractAddress: string
}

export type RhinoBridgeStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'EXPIRED'

export interface RhinoStatusResponse {
    bridgeId: string
    status: RhinoBridgeStatus
    txHash?: string
    updatedAt: string
}

export interface RhinoTokenConfig {
    symbol: string
    address: string
    decimals: number
    logoURI?: string
}

export interface RhinoChainConfig {
    chainId: string
    chainName: string
    logoURI?: string
    tokens: RhinoTokenConfig[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
    const token = Cookies.get('jwt-token')
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    }
    if (token) {
        headers['Authorization'] = `Bearer ${token}`
    }
    return headers
}

// ─── Service Functions ───────────────────────────────────────────────────────

/**
 * Get a withdrawal quote from the Rhino backend.
 * Use mode='receive' to specify the exact amount the recipient should get.
 */
export async function getRhinoWithdrawQuote(params: RhinoWithdrawQuoteParams): Promise<RhinoQuoteResponse> {
    const response = await fetchWithSentry(`${PEANUT_API_URL}/rhino/withdraw/quote`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(params),
    })

    if (!response.ok) {
        const errorBody = await response.text().catch(() => response.statusText)
        throw new Error(`Failed to get Rhino withdraw quote: ${errorBody}`)
    }

    return response.json() as Promise<RhinoQuoteResponse>
}

/**
 * Commit to a previously obtained quote.
 * Returns the calldata needed to execute the bridge transaction on-chain.
 */
export async function commitRhinoWithdraw(quoteId: string): Promise<RhinoCommitResponse> {
    const response = await fetchWithSentry(`${PEANUT_API_URL}/rhino/withdraw/commit`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ quoteId }),
    })

    if (!response.ok) {
        const errorBody = await response.text().catch(() => response.statusText)
        throw new Error(`Failed to commit Rhino withdraw: ${errorBody}`)
    }

    return response.json() as Promise<RhinoCommitResponse>
}

/**
 * Poll the status of a Rhino bridge transfer.
 */
export async function getRhinoWithdrawStatus(bridgeId: string): Promise<RhinoStatusResponse> {
    const response = await fetchWithSentry(`${PEANUT_API_URL}/rhino/withdraw/status/${bridgeId}`, {
        method: 'GET',
        headers: getAuthHeaders(),
    })

    if (!response.ok) {
        const errorBody = await response.text().catch(() => response.statusText)
        throw new Error(`Failed to get Rhino withdraw status: ${errorBody}`)
    }

    return response.json() as Promise<RhinoStatusResponse>
}

/**
 * Fetch supported chains and tokens for Rhino withdrawals.
 */
export async function getRhinoWithdrawChains(): Promise<RhinoChainConfig[]> {
    const response = await fetchWithSentry(`${PEANUT_API_URL}/rhino/withdraw/chains`, {
        method: 'GET',
        headers: getAuthHeaders(),
    })

    if (!response.ok) {
        const errorBody = await response.text().catch(() => response.statusText)
        throw new Error(`Failed to fetch Rhino withdraw chains: ${errorBody}`)
    }

    return response.json() as Promise<RhinoChainConfig[]>
}
