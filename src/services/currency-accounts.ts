import { apiFetch } from '@/utils/api-fetch'
import { apiErrorFromResponse } from './api-error'

export interface CurrencyAsset {
    asset: 'USDC' | 'EURC'
    currency: 'USD' | 'EUR'
    chainId: string
    tokenAddress: string
    decimals: number
}
export interface CurrencyAccount extends CurrencyAsset {
    id: string
    address: string
    isDefault: boolean
}
export interface CurrencyAccountsResponse {
    accounts: CurrencyAccount[]
    available: CurrencyAsset[]
}
export type CurrencyCapabilities = {
    receive: boolean
    send: boolean
    exchange: boolean
    bankDeposit: boolean
    bankWithdraw: boolean
    bankingBlock?: 'verification_required' | 'unavailable' | null
}
export type CurrencyExchangeRate = {
    midmarket_rate: string
    buy_rate: string
    sell_rate: string
    updated_at: string
    indicative: boolean
    developerFeePercent: string
}
export type CurrencyOperationKind = 'SEND' | 'EXCHANGE' | 'BANK_DEPOSIT' | 'BANK_WITHDRAW'
export type CurrencyOperationInput = {
    requestKey: string
    kind: CurrencyOperationKind
    sourceAsset: 'EURC' | 'USDC'
    amount: string
    recipient?: string
    externalAccountId?: string
}
export type CurrencyOperation = {
    externalAccountId?: string | null
    id: string
    kind: CurrencyOperationKind
    sourceAsset: 'EURC' | 'USDC'
    amount: string
    status: string
    userOpHash: string | null
    txHash: string | null
    errorCode: string | null
    call: { to: `0x${string}`; data: `0x${string}`; value: string; chainId: string } | null
    bankInstructions: Record<string, string> | null
    destinationCurrency?: string
    receipt?: { final_amount?: string; url?: string } | null
}
export type CurrencyHistoryEntry = {
    id: string
    kind: string
    direction: 'CREDIT' | 'DEBIT'
    amount: string
    currency: 'EUR'
    asset: 'EURC'
    txHash: string | null
    at: string
}
async function currencyRequest<T>(suffix: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
    const response = await apiFetch(`/users/currency-accounts/EURC/${suffix}`, {
        method,
        signal,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        redactTelemetry: true,
    })
    if (!response.ok) throw await apiErrorFromResponse(response, 'Currency account request failed')
    return response.json()
}

export type CurrencyHistoryResponse = {
    entries: CurrencyHistoryEntry[]
    operations: CurrencyOperation[]
    cursor: string | null
    hasMore: boolean
}

export const currencyAccountsApi = {
    capabilities: () => currencyRequest<CurrencyCapabilities>('capabilities'),
    history: (cursor?: string, signal?: AbortSignal) =>
        currencyRequest<CurrencyHistoryResponse>(
            `history${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
            'GET',
            undefined,
            signal
        ),
    bankAccounts: () => currencyRequest<{ accounts: { id: string; label: string }[] }>('bank-accounts'),
    exchangeRate: (from: 'EURC' | 'USDC') => currencyRequest<CurrencyExchangeRate>(`exchange-rate?from=${from}`),
    prepare: (input: CurrencyOperationInput) => currencyRequest<CurrencyOperation>('operations', 'POST', input),
    operation: (id: string, signal?: AbortSignal) =>
        currencyRequest<CurrencyOperation>(`operations/${encodeURIComponent(id)}`, 'GET', undefined, signal),
    resume: (id: string) => currencyRequest<CurrencyOperation>(`operations/${encodeURIComponent(id)}/resume`, 'POST'),
    submit: (id: string, operation: unknown) =>
        currencyRequest<CurrencyOperation>(`operations/${encodeURIComponent(id)}/submit`, 'POST', { operation }),
    cancel: (id: string) => currencyRequest<CurrencyOperation>(`operations/${encodeURIComponent(id)}`, 'DELETE'),
    list: async (): Promise<CurrencyAccountsResponse> => {
        const response = await apiFetch('/users/currency-accounts', { method: 'GET' })
        if (!response.ok) throw await apiErrorFromResponse(response, 'Failed to load currency accounts')
        return response.json()
    },
    addEurc: async (): Promise<CurrencyAccount> => {
        const response = await apiFetch('/users/currency-accounts', {
            method: 'POST',
            body: JSON.stringify({ asset: 'EURC' }),
        })
        if (!response.ok) throw await apiErrorFromResponse(response, 'Failed to add EURC account')
        return ((await response.json()) as { account: CurrencyAccount }).account
    },
}
