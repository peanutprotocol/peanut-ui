'use client'

/**
 * Token price + wallet portfolio — direct backend calls.
 *
 * Bypasses the Next.js /api/proxy machinery entirely so this works
 * identically on web and Capacitor (which has no Next.js server).
 * The endpoints are public on peanut-api-ts (no api-key, no JWT) — CORS +
 * the per-IP rate limiter on /tokens/* are the gate.
 */

import { PEANUT_API_URL } from '@/constants/general.consts'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { type ITokenPriceData, type IUserBalance } from '@/interfaces'

async function getJson<T>(path: string, errorLabel: string): Promise<T | null> {
    const response = await fetchWithSentry(`${PEANUT_API_URL}${path}`, { method: 'GET' })
    if (response.status === 404) return null
    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`${errorLabel}: ${response.status} ${text}`)
    }
    return (await response.json()) as T
}

export async function fetchTokenPrice(tokenAddress: string, chainId: string): Promise<ITokenPriceData | undefined> {
    const qs = `address=${encodeURIComponent(tokenAddress)}&chainId=${encodeURIComponent(chainId)}`
    const result = await getJson<ITokenPriceData>(`/tokens/price?${qs}`, 'Failed to fetch token price')
    return result ?? undefined
}

export async function fetchWalletBalances(
    address: string
): Promise<{ balances: IUserBalance[]; totalBalance: number }> {
    const qs = `address=${encodeURIComponent(address)}`
    const result = await getJson<{ balances: IUserBalance[]; totalBalance: number }>(
        `/tokens/wallet-portfolio?${qs}`,
        'Failed to fetch wallet balances'
    )
    return result ?? { balances: [], totalBalance: 0 }
}
