'use client'

/**
 * Token price + wallet portfolio — backend-proxied Mobula calls.
 *
 * The Mobula API key can't be exposed to the client and Capacitor builds
 * can't use Next.js server actions, so these calls live on peanut-api-ts
 * (`GET /tokens/price`, `GET /tokens/wallet-portfolio`) and we hit them
 * via serverFetch (auto-routes web → /api/proxy/get/*, native → direct).
 */

import { serverFetch } from '@/utils/api-fetch'
import { type ITokenPriceData, type IUserBalance } from '@/interfaces'

async function getJson<T>(path: string, errorLabel: string): Promise<T | null> {
    const response = await serverFetch(path, { method: 'GET' })
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
