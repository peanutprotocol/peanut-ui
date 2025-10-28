'use client'
import React, { createContext, useEffect, useState, useCallback } from 'react'

import { getSquidChainsAndTokens } from '@/app/actions/squid'
import { fetchTokenPrice } from '@/app/actions/tokens'
import {
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    PEANUT_WALLET_TOKEN_DECIMALS,
    PEANUT_WALLET_TOKEN_IMG_URL,
    PEANUT_WALLET_TOKEN_NAME,
    PEANUT_WALLET_TOKEN_SYMBOL,
    STABLE_COINS,
    supportedMobulaChains,
} from '@/constants'
import { useWallet } from '@/hooks/wallet/useWallet'
import { type ITokenPriceData } from '@/interfaces'
import { NATIVE_TOKEN_ADDRESS } from '@/utils/token.utils'
import * as Sentry from '@sentry/nextjs'
import { interfaces } from '@squirrel-labs/peanut-sdk'

export const tokenSelectorContext = createContext({
    selectedTokenAddress: '',
    selectedChainID: '',
    selectedTokenDecimals: 0 as number | undefined,
    devconnectTokenAddress: '',
    devconnectChainId: '',
    devconnectRecipientAddress: '',
    setDevconnectTokenAddress: (address: string) => {},
    setDevconnectChainId: (chainId: string) => {},
    setDevconnectRecipientAddress: (address: string) => {},
    setSelectedTokenDecimals: (decimals: number | undefined) => {},
    setSelectedTokenAddress: (address: string) => {},
    setSelectedChainID: (chainID: string) => {},
    updateSelectedChainID: (chainID: string) => {},
    selectedTokenPrice: 0 as number | undefined,
    setSelectedTokenPrice: (price: number | undefined) => {},
    refetchXchainRoute: false as boolean,
    setRefetchXchainRoute: (value: boolean) => {},
    resetTokenContextProvider: () => {},
    isXChain: false as boolean,
    setIsXChain: (value: boolean) => {},
    selectedTokenData: undefined as ITokenPriceData | undefined,
    isFetchingTokenData: false as boolean,
    supportedSquidChainsAndTokens: {} as Record<
        string,
        interfaces.ISquidChain & { networkName: string; tokens: interfaces.ISquidToken[] }
    >,
    selectedTokenBalance: undefined as string | undefined,
    setSelectedTokenBalance: (balance: string | undefined) => {},
})

/**
 * Context provider to manage the selected token and chain ID set in the tokenSelector. Token price is fetched here and input denomination can be set here too.
 * It handles fetching token prices, updating context values, and resetting the provider based on user preferences and wallet connection status.
 */
export const TokenContextProvider = ({ children }: { children: React.ReactNode }) => {
    const { isConnected: isPeanutWallet } = useWallet()

    const peanutWalletTokenData = {
        price: 1,
        decimals: PEANUT_WALLET_TOKEN_DECIMALS,
        symbol: PEANUT_WALLET_TOKEN_SYMBOL,
        name: PEANUT_WALLET_TOKEN_NAME,
        address: PEANUT_WALLET_TOKEN,
        chainId: PEANUT_WALLET_CHAIN.id.toString(),
        logoURI: PEANUT_WALLET_TOKEN_IMG_URL,
    } as ITokenPriceData

    const emptyTokenData = {
        address: '',
        chainId: '',
        decimals: undefined,
    }

    const [selectedTokenAddress, setSelectedTokenAddress] = useState(PEANUT_WALLET_TOKEN)
    const [selectedChainID, setSelectedChainID] = useState(PEANUT_WALLET_CHAIN.id.toString())
    const [selectedTokenPrice, setSelectedTokenPrice] = useState<number | undefined>(isPeanutWallet ? 1 : undefined)
    const [refetchXchainRoute, setRefetchXchainRoute] = useState<boolean>(false)
    const [selectedTokenDecimals, setSelectedTokenDecimals] = useState<number | undefined>(PEANUT_WALLET_TOKEN_DECIMALS)
    const [isXChain, setIsXChain] = useState<boolean>(false)
    const [isFetchingTokenData, setIsFetchingTokenData] = useState<boolean>(false)
    const [selectedTokenData, setSelectedTokenData] = useState<ITokenPriceData | undefined>(
        isPeanutWallet ? peanutWalletTokenData : undefined
    )
    const [selectedTokenBalance, setSelectedTokenBalance] = useState<string | undefined>(undefined)
    const [supportedSquidChainsAndTokens, setSupportedSquidChainsAndTokens] = useState<
        Record<string, interfaces.ISquidChain & { networkName: string; tokens: interfaces.ISquidToken[] }>
    >({})
    const [devconnectTokenAddress, setDevconnectTokenAddress] = useState<string>('')
    const [devconnectChainId, setDevconnectChainId] = useState<string>('')
    const [devconnectRecipientAddress, setDevconnectRecipientAddress] = useState<string>('')

    const updateSelectedChainID = (chainID: string) => {
        setSelectedTokenAddress(NATIVE_TOKEN_ADDRESS)
        setSelectedChainID(chainID)
    }

    const resetTokenContextProvider = useCallback(() => {
        const tokenData = isPeanutWallet
            ? {
                  address: PEANUT_WALLET_TOKEN,
                  chainId: PEANUT_WALLET_CHAIN.id.toString(),
                  decimals: PEANUT_WALLET_TOKEN_DECIMALS,
              }
            : emptyTokenData

        setSelectedChainID(tokenData.chainId)
        setSelectedTokenAddress(tokenData.address)
        setSelectedTokenDecimals(tokenData.decimals)
        setSelectedTokenPrice(isPeanutWallet ? 1 : undefined)
        setSelectedTokenData(isPeanutWallet ? peanutWalletTokenData : undefined)
    }, [isPeanutWallet])

    useEffect(() => {
        let isCurrent = true // flag to check if the component is still mounted

        async function fetchAndSetTokenPrice(tokenAddress: string, chainId: string) {
            try {
                // First check if it's a Peanut Wallet USDC
                if (isPeanutWallet && tokenAddress === PEANUT_WALLET_TOKEN) {
                    setSelectedTokenData({
                        price: 1,
                        decimals: PEANUT_WALLET_TOKEN_DECIMALS,
                        symbol: PEANUT_WALLET_TOKEN_SYMBOL,
                        name: PEANUT_WALLET_TOKEN_NAME,
                        address: PEANUT_WALLET_TOKEN,
                        chainId: PEANUT_WALLET_CHAIN.id.toString(),
                        logoURI: PEANUT_WALLET_TOKEN_IMG_URL,
                    } as ITokenPriceData)
                    setSelectedTokenPrice(1)
                    setSelectedTokenDecimals(PEANUT_WALLET_TOKEN_DECIMALS)
                    return
                }

                // Then check if it's a known stablecoin from our supported tokens
                const token = supportedSquidChainsAndTokens[chainId]?.tokens.find(
                    (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
                )

                if (token && STABLE_COINS.includes(token.symbol.toUpperCase())) {
                    setSelectedTokenData({
                        price: 1,
                        decimals: token.decimals,
                        symbol: token.symbol,
                        name: token.name,
                        address: token.address,
                        chainId: chainId,
                        logoURI: token.logoURI,
                    } as ITokenPriceData)
                    setSelectedTokenPrice(1)
                    setSelectedTokenDecimals(token.decimals)
                    return
                }

                // If not a known stablecoin, proceed with price fetch
                if (!supportedMobulaChains.some((chain) => chain.chainId == chainId)) {
                    setSelectedTokenData(undefined)
                    setSelectedTokenPrice(undefined)
                    setSelectedTokenDecimals(undefined)
                    return
                }

                const tokenPriceResponse = await fetchTokenPrice(tokenAddress, chainId)
                if (!isCurrent) return

                if (tokenPriceResponse?.price) {
                    setSelectedTokenPrice(tokenPriceResponse.price)
                    setSelectedTokenDecimals(tokenPriceResponse.decimals)
                    setSelectedTokenData(tokenPriceResponse)
                } else {
                    setSelectedTokenData(undefined)
                    setSelectedTokenPrice(undefined)
                    setSelectedTokenDecimals(undefined)
                }
            } catch (error) {
                Sentry.captureException(error)
                console.log('error fetching tokenPrice, falling back to tokenDenomination')
            } finally {
                if (isCurrent) {
                    setIsFetchingTokenData(false)
                }
            }
        }

        if (selectedTokenAddress && selectedChainID) {
            setIsFetchingTokenData(true)
            setSelectedTokenData(undefined)
            setRefetchXchainRoute(true)
            setSelectedTokenPrice(undefined)
            setSelectedTokenDecimals(undefined)

            fetchAndSetTokenPrice(selectedTokenAddress, selectedChainID)
            return () => {
                isCurrent = false
                setIsFetchingTokenData(false)
            }
        }
    }, [selectedTokenAddress, selectedChainID, isPeanutWallet, supportedSquidChainsAndTokens])

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
                setSelectedChainID: setSelectedChainID,
                updateSelectedChainID,
                selectedTokenPrice,
                setSelectedTokenPrice,
                refetchXchainRoute,
                setRefetchXchainRoute,
                resetTokenContextProvider,
                isXChain,
                setIsXChain,
                selectedTokenData,
                isFetchingTokenData,
                supportedSquidChainsAndTokens,
                selectedTokenBalance,
                setSelectedTokenBalance,
                devconnectTokenAddress,
                setDevconnectTokenAddress,
                devconnectChainId,
                setDevconnectChainId,
                devconnectRecipientAddress,
                setDevconnectRecipientAddress,
            }}
        >
            {children}
        </tokenSelectorContext.Provider>
    )
}
