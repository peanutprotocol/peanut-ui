'use client'

// hook for calculating cross-chain routes and preparing transactions

import { useState, useCallback } from 'react'
import { parseUnits } from 'viem'
import { type Address, type Hex } from 'viem'
import { peanut, interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { getRoute, type PeanutCrossChainRoute } from '@/services/swap'
import { estimateTransactionCostUsd } from '@/app/actions/tokens'
import { areEvmAddressesEqual } from '@/utils/general.utils'
import { captureException } from '@sentry/nextjs'

// source token info for route calculation
export interface RouteSourceInfo {
    address: Address
    tokenAddress: Address
    chainId: string
}

// destination charge info for route calculation
export interface RouteDestinationInfo {
    recipientAddress: Address
    tokenAddress: Address
    tokenAmount: string
    tokenDecimals: number
    tokenType: number
    chainId: string
}

// unsigned transaction ready for execution
export interface PreparedTransaction {
    to: Address
    data?: Hex
    value?: bigint
}

// return type for the hook
export interface UseRouteCalculationReturn {
    route: PeanutCrossChainRoute | null
    transactions: PreparedTransaction[] | null
    estimatedGasCostUsd: number | undefined
    estimatedFromValue: string
    slippagePercentage: number | undefined
    isXChain: boolean
    isDiffToken: boolean
    isCalculating: boolean
    isFeeEstimationError: boolean
    error: string | null
    calculateRoute: (params: {
        source: RouteSourceInfo
        destination: RouteDestinationInfo
        usdAmount?: string
        disableCoral?: boolean
        skipGasEstimate?: boolean
    }) => Promise<void>
    reset: () => void
}

export const useRouteCalculation = (): UseRouteCalculationReturn => {
    const [route, setRoute] = useState<PeanutCrossChainRoute | null>(null)
    const [transactions, setTransactions] = useState<PreparedTransaction[] | null>(null)
    const [estimatedGasCostUsd, setEstimatedGasCostUsd] = useState<number | undefined>(undefined)
    const [estimatedFromValue, setEstimatedFromValue] = useState<string>('0')
    const [slippagePercentage, setSlippagePercentage] = useState<number | undefined>(undefined)
    const [isCalculating, setIsCalculating] = useState(false)
    const [isFeeEstimationError, setIsFeeEstimationError] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // computed values
    const [isXChain, setIsXChain] = useState(false)
    const [isDiffToken, setIsDiffToken] = useState(false)

    // calculate route for cross-chain or same-chain swap
    const calculateRoute = useCallback(
        async ({
            source,
            destination,
            usdAmount,
            disableCoral = false,
            skipGasEstimate = false,
        }: {
            source: RouteSourceInfo
            destination: RouteDestinationInfo
            usdAmount?: string
            disableCoral?: boolean
            skipGasEstimate?: boolean
        }) => {
            setIsCalculating(true)
            setError(null)
            setIsFeeEstimationError(false)
            setRoute(null)
            setTransactions(null)
            setEstimatedGasCostUsd(undefined)

            try {
                const _isXChain = source.chainId !== destination.chainId
                const _isDiffToken = !areEvmAddressesEqual(source.tokenAddress, destination.tokenAddress)

                setIsXChain(_isXChain)
                setIsDiffToken(_isDiffToken)

                if (_isXChain || _isDiffToken) {
                    // cross-chain or token swap needed
                    const amount = usdAmount
                        ? { fromUsd: usdAmount }
                        : { toAmount: parseUnits(destination.tokenAmount, destination.tokenDecimals) }

                    const xChainRoute = await getRoute(
                        {
                            from: source,
                            to: {
                                address: destination.recipientAddress,
                                tokenAddress: destination.tokenAddress,
                                chainId: destination.chainId,
                            },
                            ...amount,
                        },
                        { disableCoral }
                    )

                    if (xChainRoute.error) {
                        throw new Error(xChainRoute.error)
                    }

                    const slippage = Number(xChainRoute.fromAmount) / Number(destination.tokenAmount) - 1

                    setRoute(xChainRoute)
                    setTransactions(
                        xChainRoute.transactions.map((tx) => ({
                            to: tx.to,
                            data: tx.data,
                            value: BigInt(tx.value),
                        }))
                    )
                    setEstimatedGasCostUsd(xChainRoute.feeCostsUsd)
                    setEstimatedFromValue(xChainRoute.fromAmount)
                    setSlippagePercentage(slippage)
                } else {
                    // same chain, same token - prepare simple transfer
                    const tx = peanut.prepareRequestLinkFulfillmentTransaction({
                        recipientAddress: destination.recipientAddress,
                        tokenAddress: destination.tokenAddress,
                        tokenAmount: destination.tokenAmount,
                        tokenDecimals: destination.tokenDecimals,
                        tokenType: destination.tokenType as peanutInterfaces.EPeanutLinkType,
                    })

                    if (!tx?.unsignedTx) {
                        throw new Error('failed to prepare transaction')
                    }

                    const preparedTx: PreparedTransaction = {
                        to: tx.unsignedTx.to as Address,
                        data: tx.unsignedTx.data as Hex | undefined,
                        value: tx.unsignedTx.value ? BigInt(tx.unsignedTx.value.toString()) : undefined,
                    }

                    setTransactions([preparedTx])
                    setEstimatedFromValue(destination.tokenAmount)
                    setSlippagePercentage(undefined)

                    // estimate gas for external wallets
                    if (!skipGasEstimate && tx.unsignedTx.from && tx.unsignedTx.to && tx.unsignedTx.data) {
                        try {
                            const gasCost = await estimateTransactionCostUsd(
                                tx.unsignedTx.from as Address,
                                tx.unsignedTx.to as Address,
                                tx.unsignedTx.data as Hex,
                                destination.chainId
                            )
                            setEstimatedGasCostUsd(gasCost)
                        } catch (gasError) {
                            captureException(gasError)
                            setIsFeeEstimationError(true)
                        }
                    } else {
                        setEstimatedGasCostUsd(0)
                    }
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : 'failed to calculate route'
                setError(message)
                setIsFeeEstimationError(true)
            } finally {
                setIsCalculating(false)
            }
        },
        []
    )

    // reset all state
    const reset = useCallback(() => {
        setRoute(null)
        setTransactions(null)
        setEstimatedGasCostUsd(undefined)
        setEstimatedFromValue('0')
        setSlippagePercentage(undefined)
        setIsXChain(false)
        setIsDiffToken(false)
        setIsCalculating(false)
        setIsFeeEstimationError(false)
        setError(null)
    }, [])

    return {
        route,
        transactions,
        estimatedGasCostUsd,
        estimatedFromValue,
        slippagePercentage,
        isXChain,
        isDiffToken,
        isCalculating,
        isFeeEstimationError,
        error,
        calculateRoute,
        reset,
    }
}
