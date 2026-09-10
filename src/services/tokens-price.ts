'use client'

/**
 * Token prices are public (CORS + the per-IP rate limiter on /tokens/* are the
 * gate). The wallet portfolio is owner-only: the API checks the address against
 * the caller's own accounts, so that call carries the session token.
 */

import { captureException } from '@sentry/nextjs'
import { apiFetch } from '@/utils/api-fetch'
import { type ITokenPriceData, type IUserBalance } from '@/interfaces/interfaces'

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
    return result ?? undefined
}

export async function fetchWalletBalances(
    address: string
): Promise<{ balances: IUserBalance[]; totalBalance: number }> {
    // No 404 → empty mapping here, unlike fetchTokenPrice: the API answers a
    // genuinely empty wallet with 200 { balances: [] } and reserves 404 for
    // "portfolio unavailable" (Mobula down/quota). Mapping 404 to an empty
    // list told recover-funds users "no tokens to recover" whenever the
    // upstream was down — a false statement about their money (TASK-21829).
    const qs = `address=${encodeURIComponent(address)}`
    const response = await apiFetch(`/tokens/wallet-portfolio?${qs}`, { method: 'GET', includeAuth: true })
    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`Failed to fetch wallet balances: ${response.status} ${text}`)
    }
    // A malformed 200 (invalid JSON, missing balances) is the one failure
    // fetchWithSentry never reports — it saw a success. Capture it here, once,
    // so the retry state the caller renders is not a silent mystery.
    const body = (await response.json().catch(() => null)) as { balances: IUserBalance[]; totalBalance: number } | null
    if (!body || !Array.isArray(body.balances)) {
        const error = new Error('Failed to fetch wallet balances: malformed 200 response')
        captureException(error)
        throw error
    }
    return body
}
