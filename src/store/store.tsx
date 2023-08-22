'use client'
import { atom, useAtom, useSetAtom } from 'jotai'
import { useAccount } from 'wagmi'
import { useEffect } from 'react'
import peanut from '@squirrel-labs/peanut-sdk'
import * as interfaces from '@/interfaces'
import * as socketTech from '@socket.tech/socket-v2-sdk'
import { ethers } from 'ethers'
import { formatEther } from 'ethers/lib/utils'
import axios from 'axios'

export const userBalancesAtom = atom<interfaces.IUserBalance[]>([])

export const defaultChainDetailsAtom = atom<interfaces.IPeanutChainDetails[]>([])
export const defaultTokenDetailsAtom = atom<interfaces.IPeanutTokenDetail[]>([])

export const supportedChainsSocketTechAtom = atom<socketTech.ChainDetails[]>([])

export function Store({ children }: { children: React.ReactNode }) {
    const [userBalances, setUserBalances] = useAtom(userBalancesAtom)
    const setDefaultChainDetails = useSetAtom(defaultChainDetailsAtom)
    const setDefaultTokenDetails = useSetAtom(defaultTokenDetailsAtom)
    const setSupportedChainsSocketTech = useSetAtom(supportedChainsSocketTechAtom)

    const { address: userAddr, isDisconnected } = useAccount()

    useEffect(() => {
        setUserBalances([])
        if (userAddr) {
            //This will fetch all balances for the supported chains by socket.tech (https://docs.socket.tech/socket-liquidity-layer/socketll-overview/chains-dexs-bridges)
            loadUserBalances(userAddr)
            // loadGoerliUserBalances(userAddr)
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
            console.log('tokendet', chainDetailsArray)
            setDefaultChainDetails(chainDetailsArray)
            setDefaultTokenDetails(tokenDetailsArray)
        }
    }

    const loadUserBalances = async (address: string) => {
        try {
            const userBalancesResponse = await socketTech.Balances.getBalances({
                userAddress: address,
            })
            const updatedBalances: interfaces.IUserBalance[] = userBalancesResponse.result.map((balances) => {
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

    // const loadGoerliUserBalances = async (address: string) => {
    //     const optiGoerli = new ethers.providers.JsonRpcProvider(process.env.OPTI_GOERLI_RPC_URL)
    //     const goerli = new ethers.providers.JsonRpcProvider(process.env.GOERLI_RPC_URL)

    //     try {
    //         const optiBalanceWei = await optiGoerli.getBalance(address)
    //         const goerliBalanceWei = await goerli.getBalance(address)

    //         const optiBalanceEth = ethers.utils.formatEther(optiBalanceWei)
    //         const goerliBalanceEth = ethers.utils.formatEther(goerliBalanceWei)

    //         const goerliBalanceObject: interfaces.IUserBalance = {
    //             chainId: 5,
    //             symbol: 'ETH',
    //             name: 'GoerliETH',
    //             address: '',
    //             decimals: 18,
    //             amount: Number(goerliBalanceEth),
    //             price: 0,
    //             currency: 'GoerliETH',
    //             logoURI:
    //                 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    //         }
    //         const optiBalanceObject: interfaces.IUserBalance = {
    //             chainId: 420,
    //             symbol: 'ETH',
    //             name: 'GoerliETH',
    //             address: '',
    //             decimals: 18,
    //             amount: Number(optiBalanceEth),
    //             price: 0,
    //             currency: 'GoerliETH',
    //             logoURI:
    //                 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    //         }

    //         if (Number(goerliBalanceEth) > 0) {
    //             setUserBalances((prev) => {
    //                 return [...prev, goerliBalanceObject]
    //             })
    //         }
    //         if (Number(optiBalanceEth) > 0) {
    //             setUserBalances((prev) => {
    //                 return [...prev, optiBalanceObject]
    //             })
    //         }
    //     } catch (error) {
    //         console.error('Error:', error)
    //     }
    // }
    // const loadUserBalanceUsingRpc = async (chainDetail: interfaces.IPeanutChainDetails, address: string) => {
    //     const provider = new ethers.providers.JsonRpcProvider(chainDetail.rpc[0])

    //     try {
    //     } catch (error) {}
    // }

    return <>{children}</>
}
