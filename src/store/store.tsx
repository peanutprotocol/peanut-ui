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
        if (supportedMobulaChains.length == 0) {
            const supportedChains = await fetch('https://api.mobula.io/api/1/blockchains', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            })
            const supportedChainsJson = await supportedChains.json()

            //setting supported chains and mapping to simple object
            setSupportedMobulaChains(
                supportedChainsJson.data.map((chain: any) => {
                    return { chainId: chain.chainId, name: chain.name }
                })
            )
        }
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
