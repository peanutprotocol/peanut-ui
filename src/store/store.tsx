'use client'
import { atom, useAtom, useSetAtom } from 'jotai'
import { useAccount } from 'wagmi'
import { useEffect } from 'react'
import { ethers } from 'ethersv5'
import peanut from '@squirrel-labs/peanut-sdk'
import * as interfaces from '@/interfaces'
import * as hooks from '@/hooks'

export const userBalancesAtom = atom<interfaces.IUserBalance[]>([])
export const defaultChainDetailsAtom = atom<any[]>([])
export const defaultTokenDetailsAtom = atom<interfaces.IPeanutTokenDetail[]>([])

export const supportedWalletconnectChainsAtom = atom<{ chainId: string; name: string }[]>([
    { chainId: '1', name: 'Ethereum' },
    { chainId: '10', name: 'Optimism' },
    { chainId: '56', name: 'Binance Smart Chain' },
    { chainId: '100', name: 'Gnosis Chain' },
    { chainId: '137', name: 'Polygon' },
    { chainId: '324', name: 'zkSync Era' },
    { chainId: '1101', name: 'Polygon Zkevm' },
    { chainId: '8217', name: 'Klaytn Mainnet' },
    { chainId: '8453', name: 'Base' },
    { chainId: '42161', name: 'Arbitrum' },
    { chainId: '42220', name: 'Celo' },
    { chainId: '43114', name: 'Avalanche C-Chain' },
    { chainId: '7777777', name: 'Zora 1' },
    { chainId: '1313161554', name: 'Aurora 1' },
])
export const supportedMobulaChainsAtom = atom<{ name: string; chainId: string }[]>([
    {
        name: 'Fantom',
        chainId: '250',
    },
    {
        name: 'Avalanche C-Chain',
        chainId: '43114',
    },
    {
        name: 'Cronos',
        chainId: '25',
    },
    {
        name: 'DFK Subnet',
        chainId: '53935',
    },
    {
        name: 'Ethereum',
        chainId: '1',
    },
    {
        name: 'SmartBCH',
        chainId: '10000',
    },
    {
        name: 'Polygon',
        chainId: '137',
    },
    {
        name: 'BNB Smart Chain (BEP20)',
        chainId: '56',
    },
    {
        name: 'Celo',
        chainId: '42220',
    },
    {
        name: 'XDAI',
        chainId: '100',
    },
    {
        name: 'Klaytn',
        chainId: '8217',
    },
    {
        name: 'Aurora',
        chainId: '1313161554',
    },
    {
        name: 'HECO',
        chainId: '128',
    },
    {
        name: 'Harmony',
        chainId: '1666600000',
    },
    {
        name: 'Boba',
        chainId: '288',
    },
    {
        name: 'OKEX',
        chainId: '66',
    },
    {
        name: 'Moonriver',
        chainId: '1285',
    },
    {
        name: 'Moonbeam',
        chainId: '1284',
    },
    {
        name: 'BitTorrent Chain',
        chainId: '199',
    },
    {
        name: 'Oasis',
        chainId: '42262',
    },
    {
        name: 'Velas',
        chainId: '106',
    },
    {
        name: 'Arbitrum',
        chainId: '42161',
    },
    {
        name: 'Optimistic',
        chainId: '10',
    },
    {
        name: 'Kucoin',
        chainId: '321',
    },
    {
        name: 'Base',
        chainId: '8453',
    },
    {
        name: 'Shibarium',
        chainId: '109',
    },
    {
        name: 'Mantle',
        chainId: '5000',
    },
    {
        name: 'Sui',
        chainId: 'sui',
    },
    {
        name: 'ZetaChain',
        chainId: '7000',
    },
    {
        name: 'Alephium',
        chainId: 'alephium-0',
    },
])

export function Store({ children }: { children: React.ReactNode }) {
    const [userBalances, setUserBalances] = useAtom(userBalancesAtom)
    const setDefaultChainDetails = useSetAtom(defaultChainDetailsAtom)
    const setDefaultTokenDetails = useSetAtom(defaultTokenDetailsAtom)

    const gaEventTracker = hooks.useAnalyticsEventTracker('peanut-general')

    const { address: userAddr, isDisconnected } = useAccount()

    useEffect(() => {
        setUserBalances([])
        if (userAddr) {
            loadUserBalances(userAddr)
            gaEventTracker('peanut-wallet-connected', userAddr)
        }
    }, [userAddr])

    useEffect(() => {
        if (isDisconnected) {
            setUserBalances([])
        }
    }, [isDisconnected])

    useEffect(() => {
        getPeanutChainAndTokenDetails()
    }, [])

    const getPeanutChainAndTokenDetails = async () => {
        if (peanut) {
            const chainDetailsArray = Object.keys(peanut.CHAIN_DETAILS).map(
                (key) => peanut.CHAIN_DETAILS[key as keyof typeof peanut.CHAIN_DETAILS]
            )
            const tokenDetailsArray = peanut.TOKEN_DETAILS
            //NOTE: Filtering out milkomeda per request of KU
            setDefaultChainDetails(
                chainDetailsArray
                    .filter((chain) => chain.chainId !== '2001')
                    .sort((a, b) => {
                        if (a.mainnet && !b.mainnet) return -1
                        if (b.mainnet && !a.mainnet) return 1
                        return 0
                    })
            )
            setDefaultTokenDetails(tokenDetailsArray)
        }
    }

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
        }))
    }

    const loadUserBalances = async (address: string) => {
        try {
            if (userBalances.length === 0) {
                let attempts = 0
                const maxAttempts = 3
                let success = false

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

                            const mappedUserBalances = convertToUserBalances(
                                apiResponseJson.balances.filter((balance: any) => balance.value > 0.009)
                            ).sort((a, b) => {
                                if (a.chainId === b.chainId) {
                                    if (a.address.toLowerCase() === '0x0000000000000000000000000000000000000000')
                                        return -1
                                    if (b.address.toLowerCase() === '0x0000000000000000000000000000000000000000')
                                        return 1

                                    return b.amount - a.amount
                                } else {
                                    return Number(a.chainId) - Number(b.chainId)
                                }
                            })

                            setUserBalances(mappedUserBalances)
                            success = true
                        } else {
                            throw new Error('API request failed')
                        }
                    } catch (error) {
                        console.log('Error fetching userBalances: ', error)
                        attempts += 1
                        if (attempts >= maxAttempts) {
                            console.log(
                                'Max retry attempts reached for fetching balances using walletconnect. Giving up.'
                            )
                            setUserBalances([])
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Unexpected error loading userBalances: ', error)
        }
    }

    return <>{children}</>
}
