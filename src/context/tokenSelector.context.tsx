'use client'
import React, { createContext, useEffect, useState } from 'react'

import * as utils from '@/utils'
import * as consts from '@/constants'
import { type ITokenPriceData } from '@/interfaces'

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
})

/**
 * Context provider to manage the selected token and chain ID set in the tokenSelector. Token price is fetched here and input denomination can be set here too.
 * It handles fetching token prices, updating context values, and resetting the provider based on user preferences and wallet connection status.
 */
export const TokenContextProvider = ({ children }: { children: React.ReactNode }) => {
    const [selectedTokenAddress, setSelectedTokenAddress] = useState('0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85')
    const [selectedChainID, setSelectedChainID] = useState('10')
    const [selectedTokenPrice, setSelectedTokenPrice] = useState<number | undefined>(undefined)
    const [inputDenomination, setInputDenomination] = useState<inputDenominationType>('TOKEN')
    const [refetchXchainRoute, setRefetchXchainRoute] = useState<boolean>(false)
    const [selectedTokenDecimals, setSelectedTokenDecimals] = useState<number | undefined>(18)
    const [isXChain, setIsXChain] = useState<boolean>(false)
    const [isFetchingTokenData, setIsFetchingTokenData] = useState<boolean>(false)
    const [selectedTokenData, setSelectedTokenData] = useState<ITokenPriceData | undefined>(undefined)

    const preferences = utils.getPeanutPreferences()

    const updateSelectedChainID = (chainID: string) => {
        setSelectedTokenAddress('0x0000000000000000000000000000000000000000')
        setSelectedChainID(chainID)
    }

    const resetTokenContextProvider = () => {
        if (preferences && preferences.tokenAddress == selectedTokenAddress && preferences.chainId == selectedChainID)
            return
        setSelectedChainID(preferences?.tokenAddress ? preferences.chainId : '10')
        setSelectedTokenAddress(
            preferences?.tokenAddress ? preferences.tokenAddress : '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'
        )
        setSelectedTokenPrice(undefined)
        setSelectedTokenDecimals(undefined)
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
                console.log('error fetching tokenPrice, falling back to tokenDenomination')
            } finally {
                setIsFetchingTokenData(false)
            }
        }

        if (selectedTokenAddress && selectedChainID) {
            setIsFetchingTokenData(true)
            setSelectedTokenData(undefined)
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
        const prefs = utils.getPeanutPreferences()
        if (prefs && prefs.tokenAddress && prefs.chainId && prefs.decimals) {
            setSelectedTokenAddress(prefs.tokenAddress)
            setSelectedChainID(prefs.chainId)
            setSelectedTokenDecimals(prefs.decimals)
        }
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
            }}
        >
            {children}
        </tokenSelectorContext.Provider>
    )
}
