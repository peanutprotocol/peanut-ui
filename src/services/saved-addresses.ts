import { apiFetch } from '@/utils/api-fetch'
import { apiErrorFromResponse } from './api-error'
import type { SavedAddress } from '@/interfaces/interfaces'

export interface SaveAddressInput {
    address: string
    chainId: string
    nickname: string
}

export const savedAddressesApi = {
    list: async (): Promise<SavedAddress[]> => {
        const response = await apiFetch('/users/saved-addresses', { method: 'GET' })
        if (!response.ok) throw await apiErrorFromResponse(response, 'Failed to load saved addresses')
        const body = (await response.json()) as { savedAddresses: SavedAddress[] }
        return body.savedAddresses
    },

    save: async (input: SaveAddressInput): Promise<SavedAddress> => {
        const response = await apiFetch('/users/saved-addresses', { method: 'POST', body: JSON.stringify(input) })
        if (!response.ok) throw await apiErrorFromResponse(response, 'Failed to save address')
        const body = (await response.json()) as { savedAddress: SavedAddress }
        return body.savedAddress
    },

    rename: async (id: string, nickname: string): Promise<SavedAddress> => {
        const response = await apiFetch(`/users/saved-addresses/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ nickname }),
        })
        if (!response.ok) throw await apiErrorFromResponse(response, 'Failed to rename address')
        const body = (await response.json()) as { savedAddress: SavedAddress }
        return body.savedAddress
    },

    remove: async (id: string): Promise<void> => {
        const response = await apiFetch(`/users/saved-addresses/${id}`, { method: 'DELETE' })
        if (!response.ok) throw await apiErrorFromResponse(response, 'Failed to delete address')
    },
}
