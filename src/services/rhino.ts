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

        if (!response.ok) {
            throw new Error(`Failed to fetch deposit address status: ${response.statusText}`)
        }

        const data = await response.json()
        return data
    },

    resetDepositAddressStatus: async (depositAddress: string): Promise<boolean> => {
        const response = await serverFetch(`/rhino/reset-status/${depositAddress}`, {
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
