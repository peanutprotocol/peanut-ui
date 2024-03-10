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

export const supportedMobulaChainsAtom = atom<{ chainId: string; name: string }[]>([])

const mobulaChains = [
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
]

export function Store({ children }: { children: React.ReactNode }) {
    const [userBalances, setUserBalances] = useAtom(userBalancesAtom)
    const setDefaultChainDetails = useSetAtom(defaultChainDetailsAtom)
    const setDefaultTokenDetails = useSetAtom(defaultTokenDetailsAtom)

    const [supportedMobulaChains, setSupportedMobulaChains] = useAtom(supportedMobulaChainsAtom)
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
        getSupportedChainsMobula()
        getPeanutChainAndTokenDetails()
    }, [])

    // Fetch supported chains from Mobula, use this to display supported peanut chains in the UI that arent supported by mobula
    // Not needed to do in BFF since this api call doesnt need an API key
    const getSupportedChainsMobula = async () => {
        // if (supportedMobulaChains.length == 0) {
        // const supportedChains = await fetch('https://api.mobula.io/api/1/blockchains', {
        //     method: 'GET',
        //     headers: {
        //         'Content-Type': 'application/json',
        //     },
        // })
        // const supportedChainsJson = await supportedChains.json()

        // //setting supported chains and mapping to simple object
        // setSupportedMobulaChains(
        //     supportedChainsJson.data.map((chain: any) => {
        //         return { chainId: chain.chainId, name: chain.name }
        //     })
        // )
        setSupportedMobulaChains(mobulaChains)
        // }
    }

    const getPeanutChainAndTokenDetails = async () => {
        if (peanut) {
            const chainDetailsArray = Object.keys(peanut.CHAIN_DETAILS).map(
                (key) => peanut.CHAIN_DETAILS[key as keyof typeof peanut.CHAIN_DETAILS]
            )
            const tokenDetailsArray = peanut.TOKEN_DETAILS
            //NOTE: Filtering out milkomeda per request of KU
            setDefaultChainDetails(chainDetailsArray.filter((chain) => chain.chainId !== '2001'))
            setDefaultTokenDetails(tokenDetailsArray)
        }
    }

    // Function to map the mobula response to the IUserBalance interface
    function mapToUserBalances(data: any): interfaces.IUserBalance[] {
        const userBalances: interfaces.IUserBalance[] = []
        data.assets.forEach((asset: any) => {
            const { name, symbol, logo } = asset.asset
            Object.keys(asset.contracts_balances).forEach((chainKey) => {
                const contractBalance = asset.contracts_balances[chainKey]
                userBalances.push({
                    chainId: contractBalance.chainId,
                    address: contractBalance.address,
                    name,
                    symbol,
                    decimals: contractBalance.decimals,
                    price: asset.price,
                    amount: contractBalance.balance,
                    currency: 'USD',
                    logoURI: logo,
                })
            })
        })

        return userBalances
    }

    const loadUserBalances = async (address: string) => {
        try {
            if (userBalances.length === 0) {
                const mobulaResponse = await fetch('/api/mobula/fetch-wallet-balance', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        address,
                    }),
                })

                const mobulaResponseJson = await mobulaResponse.json()

                const mappedUserBalances = mapToUserBalances(mobulaResponseJson.data).sort(
                    (a: interfaces.IUserBalance, b: interfaces.IUserBalance) => {
                        if (a.chainId === b.chainId) {
                            if (a.address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') return -1
                            if (b.address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') return 1

                            return b.amount - a.amount
                        } else {
                            return Number(a.chainId) - Number(b.chainId)
                        }
                    }
                )

                if (mobulaResponse.ok) {
                    setUserBalances(mappedUserBalances)
                } else {
                    setUserBalances([])
                }
            }
        } catch (error) {
            console.log(error)
            console.error('error loading userBalances, ', error)
        }
    }

    return <>{children}</>
}
