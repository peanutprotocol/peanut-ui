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

export const currencyAccountsApi = {
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
