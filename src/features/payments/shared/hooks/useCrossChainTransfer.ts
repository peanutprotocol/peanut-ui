'use client'

/**
 * Unified cross-chain transfer hook — Rhino SDA flow.
 *
 * Replaces useRouteCalculation (the legacy Squid route hook). Same three consumers:
 *   - Withdraw flow   (user's kernel wallet → external chain)
 *   - Pay-request     (payer's kernel wallet → merchant's chain)
 *   - Claim-link      (relayer EOA → claimer's chain, via /claim)
 *
 * Same-chain same-token fallback uses Peanut SDK's
 * `prepareRequestLinkFulfillmentTransaction` — unchanged vs the old hook.
 *
 * For cross-chain: provisions (or reuses) an SDA on the source chain via
 * the unified /rhino/sda-transfer endpoint and returns a single ERC20
 * transfer() tx the smart account signs. Rhino's BRIDGE_EXECUTED webhook
 * advances downstream state (charge paid, claim settled, etc.) — the UI
 * does NOT call recordPayment for cross-chain; the webhook does it.
 *
 * @example
 * const { transactions, receiveAmount, sdaAddress, calculate, isCalculating } = useCrossChainTransfer()
 * await calculate({ source, destination, context: 'withdraw', contextId: chargeUuid })
 */

import { useCallback, useState } from 'react'
import { captureException } from '@sentry/nextjs'
import { encodeFunctionData, erc20Abi, parseUnits, type Address, type Hex } from 'viem'
import * as peanutInterfaces from '@/interfaces/peanut-sdk-types'
import { prepareRequestLinkFulfillmentTransaction } from '@/utils/peanut-claim.utils'
import { estimateTransactionCostUsd } from '@/app/actions/tokens'
import {
    provisionSdaTransfer,
    previewSdaTransfer,
    type RhinoTransferContext,
    type RhinoSupportedToken,
    type SdaPreviewResult,
    type SdaTransferResult,
} from '@/services/rhino-sda'
import { evmChainIdToRhinoName } from '@/constants/rhino.consts'
import { areEvmAddressesEqual, getTokenSymbol } from '@/utils/general.utils'

export interface CrossChainSourceInfo {
    address: Address
    tokenAddress: Address
    chainId: string
}

export interface CrossChainDestinationInfo {
    recipientAddress: Address
    tokenAddress: Address
    tokenAmount: string
    tokenDecimals: number
    tokenType: number
    chainId: string
    /** Rhino-friendly token symbol — 'USDC' or 'USDT'. Falls back from tokenAddress if omitted. */
    tokenSymbol?: RhinoSupportedToken
}

export interface PreparedTransaction {
    to: Address
    data?: Hex
    value?: bigint
}

export interface UseCrossChainTransferReturn {
    transactions: PreparedTransaction[] | null
    sdaAddress: Address | null
    receiveAmount: string | null
    feeUsd: number | undefined
    estimatedGasCostUsd: number | undefined
    minDepositLimitUsd: number | undefined
    maxDepositLimitUsd: number | undefined
    isXChain: boolean
    isDiffToken: boolean
    isCalculating: boolean
    isFeeEstimationError: boolean
    error: string | null
    calculate: (params: CalculateInput) => Promise<void>
    reset: () => void
}

interface CalculateInput {
    source: CrossChainSourceInfo
    destination: CrossChainDestinationInfo
    /** Which backend flow this transfer belongs to. */
    context: RhinoTransferContext
    /** Charge uuid for withdraw/pay-request, claim pubKey for claim-xchain. */
    contextId: string
    /** Optional peanut-wallet sender — threaded through for pay-request attribution. */
    senderPeanutWalletAddress?: Address
    skipGasEstimate?: boolean
}

function inferTokenSymbol(chainId: string, tokenAddress: Address): RhinoSupportedToken | undefined {
    const symbol = getTokenSymbol(tokenAddress, chainId)?.toUpperCase()
    return symbol === 'USDC' || symbol === 'USDT' ? symbol : undefined
}

export function useCrossChainTransfer(): UseCrossChainTransferReturn {
    const [transactions, setTransactions] = useState<PreparedTransaction[] | null>(null)
    const [sdaAddress, setSdaAddress] = useState<Address | null>(null)
    const [receiveAmount, setReceiveAmount] = useState<string | null>(null)
    const [feeUsd, setFeeUsd] = useState<number | undefined>(undefined)
    const [estimatedGasCostUsd, setEstimatedGasCostUsd] = useState<number | undefined>(undefined)
    const [minDepositLimitUsd, setMinDepositLimitUsd] = useState<number | undefined>(undefined)
    const [maxDepositLimitUsd, setMaxDepositLimitUsd] = useState<number | undefined>(undefined)
    const [isXChain, setIsXChain] = useState(false)
    const [isDiffToken, setIsDiffToken] = useState(false)
    const [isCalculating, setIsCalculating] = useState(false)
    const [isFeeEstimationError, setIsFeeEstimationError] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const reset = useCallback(() => {
        setTransactions(null)
        setSdaAddress(null)
        setReceiveAmount(null)
        setFeeUsd(undefined)
        setEstimatedGasCostUsd(undefined)
        setMinDepositLimitUsd(undefined)
        setMaxDepositLimitUsd(undefined)
        setIsXChain(false)
        setIsDiffToken(false)
        setIsCalculating(false)
        setIsFeeEstimationError(false)
        setError(null)
    }, [])

    const calculate = useCallback(
        async ({ source, destination, context, contextId, senderPeanutWalletAddress, skipGasEstimate }: CalculateInput) => {
            setIsCalculating(true)
            setError(null)
            setIsFeeEstimationError(false)
            setTransactions(null)
            setSdaAddress(null)
            setReceiveAmount(null)
            setFeeUsd(undefined)
            setEstimatedGasCostUsd(undefined)

            try {
                const _isXChain = source.chainId !== destination.chainId
                const _isDiffToken = !areEvmAddressesEqual(source.tokenAddress, destination.tokenAddress)
                setIsXChain(_isXChain)
                setIsDiffToken(_isDiffToken)

                if (!_isXChain && !_isDiffToken) {
                    // Same-chain, same-token: skip Rhino entirely, use Peanut SDK's
                    // request-link fulfillment (existing behavior — unchanged).
                    await buildSameChainTx({
                        destination,
                        setTransactions,
                        setEstimatedGasCostUsd,
                        setIsFeeEstimationError,
                        setReceiveAmount,
                        skipGasEstimate,
                    })
                    return
                }

                // Cross-chain via Rhino SDA
                const sourceRhinoChain = evmChainIdToRhinoName(source.chainId)
                const destRhinoChain = evmChainIdToRhinoName(destination.chainId)
                if (!sourceRhinoChain || !destRhinoChain) {
                    throw new Error(
                        `Unsupported Rhino chain mapping (src=${source.chainId} dest=${destination.chainId})`
                    )
                }

                const tokenSymbol =
                    destination.tokenSymbol ?? inferTokenSymbol(destination.chainId, destination.tokenAddress)
                if (!tokenSymbol) {
                    throw new Error(`Cannot infer Rhino token symbol from ${destination.tokenAddress} on chain ${destination.chainId}`)
                }

                // Run preview + provision in parallel — they don't depend on each other.
                const [preview, sda] = await Promise.all([
                    previewSdaTransfer({
                        chainIn: sourceRhinoChain,
                        chainOut: destRhinoChain,
                        token: tokenSymbol,
                        amount: destination.tokenAmount,
                        mode: 'receive', // UI always asks "merchant gets X" — user pays X + fee
                    }),
                    provisionSdaTransfer({
                        context,
                        contextId,
                        depositChain: sourceRhinoChain,
                        destinationChain: destRhinoChain,
                        destinationAddress: destination.recipientAddress,
                        tokenOut: tokenSymbol,
                        senderPeanutWalletAddress,
                    }),
                ])

                applyRhinoResult({
                    preview,
                    sda,
                    source,
                    setTransactions,
                    setSdaAddress,
                    setReceiveAmount,
                    setFeeUsd,
                    setMinDepositLimitUsd,
                    setMaxDepositLimitUsd,
                    setEstimatedGasCostUsd,
                    setIsFeeEstimationError,
                })
            } catch (err) {
                const message = err instanceof Error ? err.message : 'failed to calculate cross-chain transfer'
                setError(message)
                setIsFeeEstimationError(true)
                captureException(err)
            } finally {
                setIsCalculating(false)
            }
        },
        []
    )

    return {
        transactions,
        sdaAddress,
        receiveAmount,
        feeUsd,
        estimatedGasCostUsd,
        minDepositLimitUsd,
        maxDepositLimitUsd,
        isXChain,
        isDiffToken,
        isCalculating,
        isFeeEstimationError,
        error,
        calculate,
        reset,
    }
}

interface SameChainParams {
    destination: CrossChainDestinationInfo
    setTransactions: (tx: PreparedTransaction[] | null) => void
    setEstimatedGasCostUsd: (v: number | undefined) => void
    setIsFeeEstimationError: (v: boolean) => void
    setReceiveAmount: (v: string | null) => void
    skipGasEstimate?: boolean
}

async function buildSameChainTx({
    destination,
    setTransactions,
    setEstimatedGasCostUsd,
    setIsFeeEstimationError,
    setReceiveAmount,
    skipGasEstimate,
}: SameChainParams): Promise<void> {
    const tx = prepareRequestLinkFulfillmentTransaction({
        recipientAddress: destination.recipientAddress,
        tokenAddress: destination.tokenAddress,
        tokenAmount: destination.tokenAmount,
        tokenDecimals: destination.tokenDecimals,
        tokenType: destination.tokenType as peanutInterfaces.EPeanutLinkType,
    })
    if (!tx?.unsignedTx) {
        throw new Error('failed to prepare same-chain transaction')
    }
    setTransactions([
        {
            to: tx.unsignedTx.to as Address,
            data: tx.unsignedTx.data as Hex | undefined,
            value: tx.unsignedTx.value ? BigInt(tx.unsignedTx.value.toString()) : undefined,
        },
    ])
    setReceiveAmount(destination.tokenAmount)
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

interface RhinoResultParams {
    preview: SdaPreviewResult
    sda: SdaTransferResult
    source: CrossChainSourceInfo
    setTransactions: (tx: PreparedTransaction[] | null) => void
    setSdaAddress: (v: Address | null) => void
    setReceiveAmount: (v: string | null) => void
    setFeeUsd: (v: number | undefined) => void
    setMinDepositLimitUsd: (v: number | undefined) => void
    setMaxDepositLimitUsd: (v: number | undefined) => void
    setEstimatedGasCostUsd: (v: number | undefined) => void
    setIsFeeEstimationError: (v: boolean) => void
}

function applyRhinoResult({
    preview,
    sda,
    source,
    setTransactions,
    setSdaAddress,
    setReceiveAmount,
    setFeeUsd,
    setMinDepositLimitUsd,
    setMaxDepositLimitUsd,
    setEstimatedGasCostUsd,
    setIsFeeEstimationError,
}: RhinoResultParams): void {
    // USDC/USDT are both 6-decimal on every chain we support.
    const STABLECOIN_DECIMALS = 6
    const payAmountBaseUnits = parseUnits(preview.payAmount, STABLECOIN_DECIMALS)

    const transferData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [sda.sdaAddress, payAmountBaseUnits],
    })

    setTransactions([
        {
            to: source.tokenAddress,
            data: transferData,
        },
    ])
    setSdaAddress(sda.sdaAddress)
    setReceiveAmount(preview.receiveAmount)
    setFeeUsd(preview.feeUsd)
    setMinDepositLimitUsd(sda.minDepositLimitUsd)
    setMaxDepositLimitUsd(sda.maxDepositLimitUsd)

    // Gas for a plain ERC20 transfer is absorbed by the kernel paymaster;
    // the user-visible cost is the Rhino bridge fee (already in preview).
    setEstimatedGasCostUsd(0)
    setIsFeeEstimationError(false)
}
