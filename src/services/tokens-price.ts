'use client'

/**
 * Token price + wallet portfolio — public endpoints, no auth required.
 * CORS + the per-IP rate limiter on /tokens/* are the gate.
 */

import { apiFetch } from '@/utils/api-fetch'
import { type ITokenPriceData, type IUserBalance } from '@/interfaces/interfaces'

async function getJson<T>(path: string, errorLabel: string): Promise<T | null> {
    // includeAuth: false — public endpoints; a rate lookup must not queue
    // behind auth hydration and sends no token either way.
    const response = await apiFetch(path, { method: 'GET', includeAuth: false })
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
