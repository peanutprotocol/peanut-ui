'use client'

import { parsePositiveRate } from '@/lib/money'
import { validateNumericResponse } from '@/lib/numeric-response'

/**
 * Token prices are public (CORS + the per-IP rate limiter on /tokens/* are the
 * gate).
 */

import { apiFetch } from '@/utils/api-fetch'
import { type ITokenPriceData } from '@/interfaces/interfaces'

async function getJson<T>(path: string, errorLabel: string, includeAuth: boolean): Promise<T | null> {
    // includeAuth: false keeps a public rate lookup from queueing behind auth
    // hydration; it sends no token either way.
    const response = await apiFetch(path, { method: 'GET', includeAuth })
    if (response.status === 404) return null
    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`${errorLabel}: ${response.status} ${text}`)
    }
    return (await response.json()) as T
}

export async function fetchTokenPrice(tokenAddress: string, chainId: string): Promise<ITokenPriceData | undefined> {
    const qs = `address=${encodeURIComponent(tokenAddress)}&chainId=${encodeURIComponent(chainId)}`
    const result = await getJson<ITokenPriceData>(`/tokens/price?${qs}`, 'Failed to fetch token price', false)
    if (!result) return undefined
    if (
        parsePositiveRate(result.price) === null ||
        !Number.isInteger(result.decimals) ||
        result.decimals < 0 ||
        result.decimals > 36
    ) {
        throw new Error('Token price is unavailable')
    }
    return validateNumericResponse(result)
}
