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

import { PEANUT_API_URL } from '@/constants/general.consts'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { getAuthHeaders } from '@/utils/auth-token'
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
    destinationAddress: Address
    tokenOut: RhinoSupportedToken
    senderPeanutWalletAddress?: Address
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
}

export interface SdaPreviewResult {
    payAmount: string
    payAmountUsd: number
    receiveAmount: string
    receiveAmountUsd: number
    feeUsd: number
}

async function postRhino<TReq, TRes>(path: string, body: TReq, errorLabel: string): Promise<TRes> {
    const response = await fetchWithSentry(`${PEANUT_API_URL}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
        },
        body: JSON.stringify(body),
    })
    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`${errorLabel}: ${response.status} ${text}`)
    }
    return (await response.json()) as TRes
}

export async function provisionSdaTransfer(body: SdaTransferRequest): Promise<SdaTransferResult> {
    return postRhino('/rhino/sda-transfer', body, 'Failed to provision SDA transfer')
}

export async function previewSdaTransfer(body: SdaPreviewRequest): Promise<SdaPreviewResult> {
    return postRhino('/rhino/sda-transfer/preview', body, 'Failed to preview SDA transfer')
}
