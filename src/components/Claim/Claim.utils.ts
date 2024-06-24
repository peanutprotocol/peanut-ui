import * as _interfaces from './Claim.interfaces'
import * as interfaces from '@/interfaces'

export function mapToIPeanutChainDetailsArray(
    data: _interfaces.SquidChainWithTokens[] | undefined
): _interfaces.CombinedType[] {
    if (!data) return []

    const combinedArray: _interfaces.CombinedType[] = []
    data.forEach((chain) => {
        const chainDetails: interfaces.IPeanutChainDetails = {
            name: chain.axelarChainName || '',
            chain: chain.chainType || '',
            icon: {
                url: chain.chainIconURI || '',
                format: '',
            },
            rpc: [],
            features: [],
            faucets: [],
            nativeCurrency: {
                name: '',
                symbol: '',
                decimals: 0,
            },
            infoURL: '',
            shortName: '',
            chainId: chain.chainId || '',
            networkId: 0,
            slip44: 0,
            ens: {
                registry: '',
            },
            explorers: [],
            mainnet: true,
        }

        const combinedObject: _interfaces.CombinedType = {
            ...chainDetails,
            tokens: [],
        }

        if (chain.tokens && chain.tokens.length > 0) {
            chain.tokens.forEach((token) => {
                combinedObject.tokens.push({
                    address: token.address || '',
                    name: token.name || '',
                    symbol: token.symbol || '',
                    decimals: 0,
                    logoURI: token.logoURI || '',
                    chainId: chain.chainId || '',
                })
            })
        }

        combinedArray.push(combinedObject) // Pushing the combined object for the chain
    })

    return combinedArray
}

export const fetchUser = async (accountIdentifier: string): Promise<any> => {
    const response = await fetch(`/api/peanut/user/get-user?accountIdentifier=${accountIdentifier}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    })

    if (response.status === 404) {
        return undefined
    }

    const data = await response.json()
    return data
}

export const createUser = async (
    bridgeCustomerId: string,
    email: string,
    fullName: string,
    physicalAddress?: {
        street_line_1: string
        city: string
        country: string
        state: string
        postal_code: string
    },
    userDetails?: any
): Promise<any> => {
    const response = await fetch('/api/peanut/user/create-user', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            bridgeCustomerId,
            email,
            fullName,
            physicalAddress,
            userDetails,
        }),
    })

    if (!response.ok) {
        throw new Error('Failed to create user')
    }

    const data = await response.json()
    return data
}

export const createAccount = async (
    bridgeCustomerId: string,
    bridgeAccountId: string,
    accountIdentifier: string,
    accountDetails: any
): Promise<any> => {
    const response = await fetch('/api/peanut/user/create-account', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            bridgeCustomerId,
            bridgeAccountId,
            accountIdentifier,
            accountDetails,
        }),
    })

    if (!response.ok) {
        throw new Error('Failed to create account')
    }

    const data = await response.json()
    return data
}
