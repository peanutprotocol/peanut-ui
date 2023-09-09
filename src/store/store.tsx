'use client'
import { atom, useAtom, useSetAtom } from 'jotai'
import { useAccount } from 'wagmi'
import { useEffect } from 'react'
import peanut from '@squirrel-labs/peanut-sdk'
import * as interfaces from '@/interfaces'
import * as socketTech from '@socket.tech/socket-v2-sdk'
import * as hooks from '@/hooks'

export const userBalancesAtom = atom<interfaces.IUserBalance[]>([])

export const defaultChainDetailsAtom = atom<interfaces.IPeanutChainDetails[]>([])
export const defaultTokenDetailsAtom = atom<interfaces.IPeanutTokenDetail[]>([])

export const supportedChainsSocketTechAtom = atom<socketTech.ChainDetails[]>([])

export function Store({ children }: { children: React.ReactNode }) {
    const [, setUserBalances] = useAtom(userBalancesAtom)
    const setDefaultChainDetails = useSetAtom(defaultChainDetailsAtom)
    const setDefaultTokenDetails = useSetAtom(defaultTokenDetailsAtom)
    const setSupportedChainsSocketTech = useSetAtom(supportedChainsSocketTechAtom)
    const gaEventTracker = hooks.useAnalyticsEventTracker('peanut-general')

    const { address: userAddr, isDisconnected } = useAccount()

    useEffect(() => {
        setUserBalances([])
        if (userAddr) {
            //This will fetch all balances for the supported chains by socket.tech (https://docs.socket.tech/socket-liquidity-layer/socketll-overview/chains-dexs-bridges)
            loadUserBalances(userAddr)
            // loadGoerliUserBalances(userAddr)
            gaEventTracker('peanut-wallet-connected', userAddr)
        }
    }, [userAddr])

    useEffect(() => {
        if (isDisconnected) {
            setUserBalances([])
        }
    }, [isDisconnected])

    useEffect(() => {
        getSupportedChainsSocketTech()
        getPeanutChainAndTokenDetails()
    }, [])

    const getSupportedChainsSocketTech = async () => {
        try {
            const supportedChainsResponse = await socketTech.Supported.getAllSupportedChains()
            if (supportedChainsResponse.success) {
                setSupportedChainsSocketTech(supportedChainsResponse.result)
            }
        } catch (error) {
            console.error('error loading supportedChainsSocketTech, ', error)
        }
    }

    const getPeanutChainAndTokenDetails = async () => {
        if (peanut) {
            const chainDetailsArray = Object.keys(peanut.CHAIN_DETAILS).map((key) => peanut.CHAIN_DETAILS[key])
            const tokenDetailsArray = peanut.TOKEN_DETAILS
            setDefaultChainDetails(chainDetailsArray)
            setDefaultTokenDetails(tokenDetailsArray)
        }
    }

    const loadUserBalances = async (address: string) => {
        try {
            const userBalancesResponse = await socketTech.Balances.getBalances({
                userAddress: address,
            })

            const updatedBalances: interfaces.IUserBalance[] = userBalancesResponse.result
                .map((balances) => {
                    return {
                        chainId: balances.chainId,
                        symbol: balances.symbol,
                        name: balances.name,
                        address: balances.address,
                        decimals: balances.decimals,
                        amount: Number(balances.amount),
                        price: 0,
                        currency: balances.currency,
                        //@ts-ignore
                        logoURI: balances.logoURI,
                    }
                })
                .sort((a: interfaces.IUserBalance, b: interfaces.IUserBalance) => {
                    if (a.chainId === b.chainId) {
                        // If the address is the native currency, move it to the top
                        if (a.address === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') return -1
                        if (b.address === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') return 1

                        // If 'chainId' is the same, sort by 'amount'
                        return b.amount - a.amount
                    } else {
                        // Else sort by 'chainId'
                        return a.chainId - b.chainId
                    }
                })

            2

            if (userBalancesResponse.success) {
                setUserBalances((prev) => {
                    return [...prev, ...updatedBalances]
                })
            } else {
                setUserBalances([])
            }
        } catch (error) {
            console.error('error loading userBalances, ', error)
        }
    }

    return <>{children}</>
}
