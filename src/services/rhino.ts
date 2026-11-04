import { serverFetch } from '@/utils/api-fetch'
import type { CreateDepositAddressResponse, DepositAddressStatusResponse, RhinoChainType } from './services.types'

export const rhinoApi = {
    createDepositAddress: async (
        destinationAddress: string,
        chainType: RhinoChainType,
        identifier: string
    ): Promise<CreateDepositAddressResponse> => {
        const response = await serverFetch('/rhino/deposit', {
            method: 'POST',
            body: JSON.stringify({ destinationAddress, type: chainType, addressNote: identifier }),
        })
        if (!response.ok) {
            throw new Error(`Failed to fetch deposit address: ${response.statusText}`)
        }
        const data = await response.json()
        return data as CreateDepositAddressResponse
    },

    getDepositAddressStatus: async (depositAddress: string): Promise<DepositAddressStatusResponse> => {
        const response = await serverFetch(`/rhino/status/${depositAddress}`, {
            method: 'GET',
        })

        if (response.status === 404) {
            const data = await response.json().catch(() => null)
            if (data?.error === 'No update found for given deposit address') return { status: 'not_started' }
        }
        if (!response.ok) {
            throw new Error(`Failed to fetch deposit address status: ${response.statusText}`)
        }

        const data = await response.json()
        return data
    },

    /**
     * A request payment's address is cleared with its charge id: the payer may
     * be signed out, and the API binds the clear to the charge (TASK-24366).
     */
    resetDepositAddressStatus: async (depositAddress: string, chargeId?: string): Promise<boolean> => {
        const query = chargeId ? `?chargeId=${encodeURIComponent(chargeId)}` : ''
        const response = await serverFetch(`/rhino/reset-status/${depositAddress}${query}`, {
            method: 'POST',
        })

        if (!response.ok) {
            throw new Error(`Failed to update deposit address status: ${response.statusText}`)
        }

        return true
    },

    createRequestFulfilmentAddress: async (
        chainType: RhinoChainType,
        chargeId: string,
        peanutWalletAddress?: string
    ): Promise<CreateDepositAddressResponse> => {
        const response = await serverFetch('/rhino/request-fulfilment', {
            method: 'POST',
            body: JSON.stringify({
                type: chainType,
                chargeId,
                senderPeanutWalletAddress: peanutWalletAddress,
            }),
        })
        if (!response.ok) {
            throw new Error(`Failed to fetch Request Fulfilment Address: ${response.statusText}`)
        }
        const data = await response.json()
        return data as CreateDepositAddressResponse
    },
}
