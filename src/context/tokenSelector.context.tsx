'use client'
import React, { createContext, useEffect, useMemo, useState } from 'react'

import { getSquidChainsAndTokens } from '@/app/actions/squid'
import * as consts from '@/constants'
import { useWallet } from '@/hooks/wallet/useWallet'
import { type ITokenPriceData } from '@/interfaces'
import * as utils from '@/utils'
import * as Sentry from '@sentry/nextjs'
import { interfaces } from '@squirrel-labs/peanut-sdk'

type inputDenominationType = 'USD' | 'TOKEN'

export const tokenSelectorContext = createContext({
    selectedTokenAddress: '',
    selectedChainID: '',
    selectedTokenDecimals: 0 as number | undefined,
    setSelectedTokenDecimals: (decimals: number | undefined) => {},
    setSelectedTokenAddress: (address: string) => {},
    setSelectedChainID: (chainID: string) => {},
    selectedTokenPrice: 0 as number | undefined,
    setSelectedTokenPrice: (price: number | undefined) => {},
    inputDenomination: 'TOKEN' as inputDenominationType,
    setInputDenomination: (denomination: inputDenominationType) => {},
    refetchXchainRoute: false as boolean,
    setRefetchXchainRoute: (value: boolean) => {},
    resetTokenContextProvider: () => {},
    isXChain: false as boolean,
    setIsXChain: (value: boolean) => {},
    selectedTokenData: undefined as ITokenPriceData | undefined,
    isFetchingTokenData: false as boolean,
    supportedSquidChainsAndTokens: {} as Record<string, interfaces.ISquidChain & { tokens: interfaces.ISquidToken[] }>,
})

/**
 * Context provider to manage the selected token and chain ID set in the tokenSelector. Token price is fetched here and input denomination can be set here too.
 * It handles fetching token prices, updating context values, and resetting the provider based on user preferences and wallet connection status.
 */
export const TokenContextProvider = ({ children }: { children: React.ReactNode }) => {
    const { isPeanutWallet } = useWallet()

    const initialTokenData = useMemo(() => {
        if (isPeanutWallet) {
            return {
                address: consts.PEANUT_WALLET_TOKEN,
                chainId: consts.PEANUT_WALLET_CHAIN.id.toString(),
                decimals: 6,
            }
        }

        const { lastUsedToken } = utils.getUserPreferences() ?? {}
        return (
            lastUsedToken ?? {
                address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC
                chainId: '10', // Optimism
                decimals: 6,
            }
        )
    }, [isPeanutWallet])

    const [selectedTokenAddress, setSelectedTokenAddress] = useState(initialTokenData.address)
    const [selectedChainID, setSelectedChainID] = useState(initialTokenData.chainId)
    const [selectedTokenPrice, setSelectedTokenPrice] = useState<number | undefined>(undefined)
    const [inputDenomination, setInputDenomination] = useState<inputDenominationType>('TOKEN')
    const [refetchXchainRoute, setRefetchXchainRoute] = useState<boolean>(false)
    const [selectedTokenDecimals, setSelectedTokenDecimals] = useState<number | undefined>(initialTokenData.decimals)
    const [isXChain, setIsXChain] = useState<boolean>(false)
    const [isFetchingTokenData, setIsFetchingTokenData] = useState<boolean>(false)
    const [selectedTokenData, setSelectedTokenData] = useState<ITokenPriceData | undefined>(undefined)
    const [supportedSquidChainsAndTokens, setSupportedSquidChainsAndTokens] = useState<
        Record<string, interfaces.ISquidChain & { tokens: interfaces.ISquidToken[] }>
    >({})

    const updateSelectedChainID = (chainID: string) => {
        setSelectedTokenAddress('0x0000000000000000000000000000000000000000')
        setSelectedChainID(chainID)
    }

    const resetTokenContextProvider = () => {
        const { lastUsedToken } = utils.getUserPreferences() ?? {}
        const tokenData = lastUsedToken ?? initialTokenData
        setSelectedChainID(tokenData.chainId)
        setSelectedTokenAddress(tokenData.address)
        setSelectedTokenDecimals(tokenData.decimals)
        setSelectedTokenPrice(undefined)
        setInputDenomination('TOKEN')
        setSelectedTokenData(undefined)
    }

    useEffect(() => {
        let isCurrent = true

        async function fetchAndSetTokenPrice(tokenAddress: string, chainId: string) {
            setIsFetchingTokenData(true)
            try {
                if (!consts.supportedMobulaChains.some((chain) => chain.chainId == chainId)) {
                    setSelectedTokenData(undefined)
                    setSelectedTokenPrice(undefined)
                    setSelectedTokenDecimals(undefined)
                    setInputDenomination('TOKEN')
                    return
                } else {
                    const tokenPriceResponse = await utils.fetchTokenPrice(tokenAddress, chainId)
                    if (!isCurrent) {
                        return // if landed here, fetch outdated so discard the result
                    }
                    if (tokenPriceResponse?.price) {
                        setSelectedTokenPrice(tokenPriceResponse.price)
                        setSelectedTokenDecimals(tokenPriceResponse.decimals)
                        setSelectedTokenData(tokenPriceResponse)
                        if (tokenPriceResponse.price === 1) {
                            setInputDenomination('TOKEN')
                        } else {
                            setInputDenomination('USD')
                        }
                    } else {
                        setSelectedTokenData(undefined)
                        setSelectedTokenPrice(undefined)
                        setSelectedTokenDecimals(undefined)
                        setInputDenomination('TOKEN')
                    }
                }
            } catch (error) {
                Sentry.captureException(error)
                console.log('error fetching tokenPrice, falling back to tokenDenomination')
            } finally {
                setIsFetchingTokenData(false)
            }
        }

        if (selectedTokenAddress && selectedChainID) {
            setIsFetchingTokenData(true)
            setSelectedTokenData(undefined)
            setRefetchXchainRoute(true)
            setSelectedTokenPrice(undefined)
            setSelectedTokenDecimals(undefined)
            setInputDenomination('TOKEN')
            fetchAndSetTokenPrice(selectedTokenAddress, selectedChainID)
            return () => {
                isCurrent = false
            }
        }
    }, [selectedTokenAddress, selectedChainID])

    useEffect(() => {
        getSquidChainsAndTokens().then(setSupportedSquidChainsAndTokens)
    }, [])

    return (
        <tokenSelectorContext.Provider
            value={{
                setSelectedTokenDecimals,
                selectedTokenAddress,
                setSelectedTokenAddress,
                selectedTokenDecimals,
                selectedChainID,
                setSelectedChainID: updateSelectedChainID,
                selectedTokenPrice,
                setSelectedTokenPrice,
                inputDenomination,
                setInputDenomination,
                refetchXchainRoute,
                setRefetchXchainRoute,
                resetTokenContextProvider,
                isXChain,
                setIsXChain,
                selectedTokenData,
                isFetchingTokenData,
                supportedSquidChainsAndTokens,
            }}
        >
            {children}
        </tokenSelectorContext.Provider>
    )
}
