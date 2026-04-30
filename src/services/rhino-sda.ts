'use client'

/**
 * Client-side wrappers around the unified Rhino SDA-transfer backend.
 *
 * Three consumers: withdraw, pay-request-x-chain, claim-link-x-chain —
 * all route through these two calls.
 */

import { apiFetch } from '@/utils/api-fetch'
import type { Address } from 'viem'

export type RhinoTransferContext = 'withdraw' | 'pay-request' | 'claim-xchain'
export type RhinoSupportedToken = 'USDC' | 'USDT'

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
    const response = await apiFetch(path, `/api/peanut${path}`, {
        method: 'POST',
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
