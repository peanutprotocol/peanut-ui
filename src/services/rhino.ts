import type { CreateDepositAddressResponse, RhinoChainType } from './services.types'
import { PEANUT_API_URL } from '@/constants/general.consts'
import Cookies from 'js-cookie'

export const rhinoApi = {
    createDepositAddress: async (
        destinationAddress: string,
        chainType: RhinoChainType,
        identifier: string
    ): Promise<CreateDepositAddressResponse> => {
        const token = Cookies.get('jwt-token')
        if (!token) {
            throw new Error('Authentication required')
        }

        const response = await fetch(`${PEANUT_API_URL}/rhino/deposit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ destinationAddress, type: chainType, addressNote: identifier }),
        })
        if (!response.ok) {
            throw new Error(`Failed to fetch deposit address: ${response.statusText}`)
        }
        const data = await response.json()
        return data as CreateDepositAddressResponse
    },

    getDepositAddressStatus: async (depositAddress: string): Promise<{ status: string; amount?: number }> => {
        const token = Cookies.get('jwt-token')
        if (!token) {
            throw new Error('Authentication required')
        }

        const response = await fetch(`${PEANUT_API_URL}/rhino/status/${depositAddress}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch deposit address status: ${response.statusText}`)
        }

        const data = await response.json()
        return data
    },

    resetDepositAddressStatus: async (depositAddress: string): Promise<boolean> => {
        const token = Cookies.get('jwt-token')
        if (!token) {
            throw new Error('Authentication required')
        }
        const response = await fetch(`${PEANUT_API_URL}/rhino/reset-status/${depositAddress}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        })

        if (!response.ok) {
            throw new Error(`Failed to update deposit address status: ${response.statusText}`)
        }

        return true
    },

    createRequestFulfilmentAddress: async (
        requestId: string,
        chainType: RhinoChainType,
        chargeId: string,
        peanutWalletAddress?: string
    ): Promise<CreateDepositAddressResponse> => {
        const token = Cookies.get('jwt-token')
        if (!token) {
            throw new Error('Authentication required')
        }

        const response = await fetch(`${PEANUT_API_URL}/rhino/request-fulfilment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                requestId,
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
