'use client'
import React, { createContext, useState, useCallback, useMemo, useEffect } from 'react'

import {
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    PEANUT_WALLET_TOKEN_DECIMALS,
    PEANUT_WALLET_TOKEN_IMG_URL,
    PEANUT_WALLET_TOKEN_NAME,
    PEANUT_WALLET_TOKEN_SYMBOL,
} from '@/constants'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useSquidChainsAndTokens } from '@/hooks/useSquidChainsAndTokens'
import { useTokenPrice } from '@/hooks/useTokenPrice'
import { type ITokenPriceData } from '@/interfaces'
import { NATIVE_TOKEN_ADDRESS } from '@/utils/token.utils'
import { interfaces } from '@squirrel-labs/peanut-sdk'

export const tokenSelectorContext = createContext({
    selectedTokenAddress: '',
    selectedChainID: '',
    devconnectTokenAddress: '',
    devconnectChainId: '',
    devconnectRecipientAddress: '',
    setDevconnectTokenAddress: (address: string) => {},
    setDevconnectChainId: (chainId: string) => {},
    setDevconnectRecipientAddress: (address: string) => {},
    setSelectedTokenAddress: (address: string) => {},
    setSelectedChainID: (chainID: string) => {},
    updateSelectedChainID: (chainID: string) => {},
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
    const [refetchXchainRoute, setRefetchXchainRoute] = useState<boolean>(false)
    const [isXChain, setIsXChain] = useState<boolean>(false)
    const [selectedTokenBalance, setSelectedTokenBalance] = useState<string | undefined>(undefined)
    const [devconnectTokenAddress, setDevconnectTokenAddress] = useState<string>('')
    const [devconnectChainId, setDevconnectChainId] = useState<string>('')
    const [devconnectRecipientAddress, setDevconnectRecipientAddress] = useState<string>('')

    // Fetch Squid chains and tokens (cached for 24 hours - static data)
    const { data: supportedSquidChainsAndTokens = {} } = useSquidChainsAndTokens()

    // Fetch token price using TanStack Query (replaces manual useEffect + state)
    const {
        data: tokenPriceData,
        isLoading: isFetchingTokenData,
        isFetching,
    } = useTokenPrice({
        tokenAddress: selectedTokenAddress,
        chainId: selectedChainID,
        supportedSquidChainsAndTokens,
        isPeanutWallet,
    })

    // Derive selectedTokenData from query (single source of truth)
    const selectedTokenData = tokenPriceData

    // Trigger xchain route refetch when token data changes
    // This preserves the original behavior where setRefetchXchainRoute(true) was called
    useEffect(() => {
        if (isFetching) {
            setRefetchXchainRoute(true)
        }
    }, [isFetching])

    const updateSelectedChainID = (chainID: string) => {
        setSelectedTokenAddress(NATIVE_TOKEN_ADDRESS)
        setSelectedChainID(chainID)
    }

    const resetTokenContextProvider = useCallback(() => {
        const tokenData = isPeanutWallet
            ? {
                  address: PEANUT_WALLET_TOKEN,
                  chainId: PEANUT_WALLET_CHAIN.id.toString(),
              }
            : emptyTokenData

        setSelectedChainID(tokenData.chainId)
        setSelectedTokenAddress(tokenData.address)
        // Note: decimals, price, and data are now automatically managed by useTokenPrice hook
    }, [isPeanutWallet])

    return (
        <tokenSelectorContext.Provider
            value={{
                selectedTokenAddress,
                setSelectedTokenAddress,
                selectedChainID,
                setSelectedChainID: setSelectedChainID,
                updateSelectedChainID,
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
