import { useAccount } from 'wagmi'

import * as interfaces from '@/interfaces'
import { useEffect, useState } from 'react'

export const useBalance = () => {
    const [balances, setBalances] = useState<interfaces.IUserBalance[]>([])
    const [valuePerChain, setValuePerChain] = useState<interfaces.ChainValue[]>([])
    const { address } = useAccount()

    useEffect(() => {
        if (address) {
            fetchBalances(address).then((balances) => {
                if (balances) setBalances(balances)
            })
        }
    }, [address])

    // Function to map the mobula response to the IUserBalance interface
    function convertToUserBalances(
        data: Array<{
            name: string
            symbol: string
            chainId: string
            value: number
            price: number
            quantity: { decimals: string; numeric: string }
            iconUrl: string
            address?: string
        }>
    ): interfaces.IUserBalance[] {
        return data.map((item) => ({
            chainId: item?.chainId ? item.chainId.split(':')[1] : '1',
            address: item?.address ? item.address.split(':')[2] : '0x0000000000000000000000000000000000000000',
            name: item.name,
            symbol: item.symbol,
            decimals: parseInt(item.quantity.decimals),
            price: item.price,
            amount: parseFloat(item.quantity.numeric),
            currency: 'usd',
            logoURI: item.iconUrl,
            value: item.value.toString(),
        }))
    }

    function calculateValuePerChain(
        balances: {
            name: string
            symbol: string
            chainId: string
            value: number
            price: number
            quantity: { decimals: string; numeric: string }
            iconUrl: string
            address?: string
        }[]
    ): interfaces.ChainValue[] {
        let result: interfaces.ChainValue[] = []

        try {
            const chainValueMap: { [key: string]: number } = {}
            balances.forEach((balance) => {
                const chainId = balance?.chainId ? balance.chainId.split(':')[1] : '1'
                if (!chainValueMap[chainId]) {
                    chainValueMap[chainId] = 0
                }
                if (balance.value) chainValueMap[chainId] += balance.value
            })

            result = Object.keys(chainValueMap).map((chainId) => ({
                chainId,
                valuePerChain: chainValueMap[chainId],
            }))

            result.sort((a, b) => b.valuePerChain - a.valuePerChain)
        } catch (error) {
            console.log('Error calculating value per chain: ', error)
        }
        return result
    }

    const fetchBalances = async (address: string) => {
        try {
            let attempts = 0
            const maxAttempts = 3
            let success = false
            let userBalances

            while (!success && attempts < maxAttempts) {
                try {
                    const apiResponse = await fetch('/api/walletconnect/fetch-wallet-balance', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            address,
                        }),
                    })

                    if (apiResponse.ok) {
                        const apiResponseJson = await apiResponse.json()

                        userBalances = convertToUserBalances(
                            apiResponseJson.balances.filter((balance: any) => balance.value > 0.009)
                        )
                            .map((balance) =>
                                balance.chainId === '8508132'
                                    ? { ...balance, chainId: '534352' }
                                    : balance.chainId === '81032'
                                      ? { ...balance, chainId: '81457' }
                                      : balance.chainId === '59160'
                                        ? { ...balance, chainId: '59144' }
                                        : balance
                            )
                            .sort((a, b) => {
                                const valueA = parseFloat(a.value)
                                const valueB = parseFloat(b.value)

                                if (valueA === valueB) {
                                    if (a.address.toLowerCase() === '0x0000000000000000000000000000000000000000')
                                        return -1
                                    if (b.address.toLowerCase() === '0x0000000000000000000000000000000000000000')
                                        return 1

                                    return b.amount - a.amount
                                } else {
                                    return valueB - valueA
                                }
                            })

                        const valuePerChain = calculateValuePerChain(apiResponseJson.balances)
                        setValuePerChain(valuePerChain)
                        success = true
                    } else {
                        throw new Error('API request failed')
                    }
                } catch (error) {
                    console.log('Error fetching userBalances: ', error)
                    attempts += 1
                    if (attempts >= maxAttempts) {
                        console.log('Max retry attempts reached for fetching balances using walletconnect. Giving up.')
                    }
                }
            }

            return userBalances
        } catch (error) {
            console.error('Unexpected error loading userBalances: ', error)
        }
    }

    return { balances, fetchBalances, valuePerChain }
}
