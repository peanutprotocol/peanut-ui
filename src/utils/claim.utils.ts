/**
 * Claim utilities - Direct SDK integration
 *
 * Instead of using claimLinkGasless from SDK (which is a thin wrapper),
 * we use createClaimPayload directly and call our backend.
 *
 * This gives us more control and removes an unnecessary abstraction layer.
 */

import { createClaimPayload } from '@squirrel-labs/peanut-sdk'

export interface ClaimResponse {
    txHash: string
}

/**
 * Claims a link gaslessly using the enhanced /claim-v3 endpoint
 *
 * Password stays client-side - only signature is sent to backend
 *
 * @param link - The full peanut link (includes password in hash)
 * @param recipientAddress - Address to receive the funds
 * @param apiKey - API key for backend authentication
 * @returns Promise with transaction hash
 */
export async function claimLinkGaslessV3(link: string, recipientAddress: string, apiKey: string): Promise<string> {
    const baseUrl = process.env.NEXT_PUBLIC_PEANUT_API_URL || 'https://api.peanut.me'

    // Create claim payload (password used HERE on client-side to generate signature)
    const payload = await createClaimPayload(link, recipientAddress)

    // Password is now discarded - only signature is sent to backend
    const response = await fetch(`${baseUrl}/claim-v3`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            claimParams: payload.claimParams, // [depositIdx, recipientAddress, signature]
            chainId: payload.chainId,
            version: payload.contractVersion,
            apiKey,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Claim failed: ${errorText}`)
    }

    const data: ClaimResponse = await response.json()
    return data.txHash
}

/**
 * Claims a link using /claim-v2 (for backward compatibility)
 * Use claimLinkGaslessV3 for new implementations
 */
export async function claimLinkGaslessV2(link: string, recipientAddress: string, apiKey: string): Promise<string> {
    const baseUrl = process.env.NEXT_PUBLIC_PEANUT_API_URL || 'https://api.peanut.me'

    const payload = await createClaimPayload(link, recipientAddress)

    const response = await fetch(`${baseUrl}/claim-v2`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            claimParams: payload.claimParams,
            chainId: payload.chainId,
            version: payload.contractVersion,
            apiKey,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Claim failed: ${errorText}`)
    }

    const data: ClaimResponse = await response.json()
    return data.txHash
}
