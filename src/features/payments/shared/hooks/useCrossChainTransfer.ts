'use client'

/**
 * Unified cross-chain transfer hook — Rhino SDA flow.
 *
 * Three consumers:
 *   - Withdraw flow   (user's kernel wallet → external chain)
 *   - Pay-request     (payer's kernel wallet → merchant's chain)
 *   - Claim-link      (relayer EOA → claimer's chain, via /claim)
 *
 * Same-chain same-token: uses Peanut SDK's `prepareRequestLinkFulfillmentTransaction`.
 *
 * Cross-chain: provisions (or reuses) an SDA on the source chain via the unified
 * /rhino/sda-transfer endpoint and returns a single ERC20 transfer() tx the smart
 * account signs. Rhino's BRIDGE_EXECUTED webhook advances downstream state
 * (charge paid, claim settled, etc.) — the UI does NOT call recordPayment for
 * cross-chain; the webhook does it.
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
import {
    getBridgeQuote,
    commitBridgeQuote,
    getBridgeStatus,
    isQuoteNearExpiry,
    type BridgeQuoteResponse,
    type BridgeCommitResponse,
    type BridgeStatusResponse,
} from '@/services/rhino-bridge'
import { evmChainIdToRhinoName } from '@/constants/rhino.consts'
import { areEvmAddressesEqual, getTokenSymbol } from '@/utils/general.utils'

/** Tokens Rhino's SDA primitive accepts as `tokenOut`. Anything else routes
 *  through the bridge quote/commit flow which supports the wider token set. */
const SDA_SUPPORTED_TOKENS = new Set(['USDC', 'USDT'])

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

/** Indicates which Rhino primitive backed the calculate result.
 *  - `sda`         → user does ERC20.transfer(sdaAddress, amount); webhook settles
 *  - `bridge`      → user signs calldata against Rhino's bridge contract directly
 *  - `same-chain`  → no Rhino; Peanut SDK request-link fulfillment */
export type CrossChainPath = 'sda' | 'bridge' | 'same-chain'

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
    /** Which path produced the current `transactions` (null before calculate). */
    path: CrossChainPath | null
    /** Bridge-only: ISO expiry on Rhino quote. SDA / same-chain don't expire. */
    quoteExpiresAt: string | null
    /** Bridge-only: commitment id (for status polling after the user signs). */
    commitmentId: string | null
    isQuoteExpired: boolean
    /** Poll `/rhino/bridge/status/:id` until COMPLETED/FAILED/EXPIRED. Bridge only. */
    pollBridgeStatus: (commitmentId: string, opts?: { timeoutMs?: number }) => Promise<BridgeStatusResponse>
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
    // Whatever the curated FE list calls the token (USDC, USDT, ETH, WETH, …);
    // backend forwards it to Rhino, which validates against its own per-route
    // supported-tokens map. Native ETH on EVM uses the SAME 'ETH' symbol —
    // address differs by chain (proxy 0xeee… or zero), but Rhino keys on the
    // symbol.
    return getTokenSymbol(tokenAddress, chainId)?.toUpperCase()
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
    const [path, setPath] = useState<CrossChainPath | null>(null)
    const [quoteExpiresAt, setQuoteExpiresAt] = useState<string | null>(null)
    const [commitmentId, setCommitmentId] = useState<string | null>(null)

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
        setPath(null)
        setQuoteExpiresAt(null)
        setCommitmentId(null)
    }, [])

    const isQuoteExpired = quoteExpiresAt ? isQuoteNearExpiry(quoteExpiresAt, 0) : false

    /** Poll `/rhino/bridge/status/:id` at 3s intervals until terminal or timeout. */
    const pollBridgeStatus = useCallback(
        async (id: string, opts: { timeoutMs?: number } = {}): Promise<BridgeStatusResponse> => {
            const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1000 // 5 min — covers normal Rhino bridge ETA
            const intervalMs = 3000
            const deadline = Date.now() + timeoutMs
            // Treat anything with the substring as terminal — Rhino's status enum
            // capitalisation has shifted between versions; substring keeps us
            // resilient to that.
            const isTerminal = (s: string) => /COMPLETED|FAILED|EXPIRED/i.test(s)

            while (Date.now() < deadline) {
                const status = await getBridgeStatus(id)
                if (isTerminal(status.status)) return status
                await new Promise((r) => setTimeout(r, intervalMs))
            }
            throw new Error(`Bridge status poll timed out after ${timeoutMs}ms (id=${id})`)
        },
        []
    )

    const calculate = useCallback(
        async ({
            source,
            destination,
            context,
            contextId,
            senderPeanutWalletAddress,
            skipGasEstimate,
        }: CalculateInput) => {
            setIsCalculating(true)
            setError(null)
            setIsFeeEstimationError(false)
            setTransactions(null)
            setSdaAddress(null)
            setReceiveAmount(null)
            setFeeUsd(undefined)
            setEstimatedGasCostUsd(undefined)
            setPath(null)
            setQuoteExpiresAt(null)
            setCommitmentId(null)

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
                    setPath('same-chain')
                    return
                }

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
                    throw new Error(
                        `Cannot infer Rhino token symbol from ${destination.tokenAddress} on chain ${destination.chainId}`
                    )
                }

                // Path selection: Rhino SDA's `tokenOut` is whitelisted to USDC/USDT
                // (DepositAddressTokenOutNotSupported for ETH/WETH/etc); anything
                // else routes through the bridge quote/commit flow which supports
                // the wider token set.
                const useBridgePath = !SDA_SUPPORTED_TOKENS.has(tokenSymbol)

                if (useBridgePath) {
                    await runBridgePath({
                        source,
                        destination,
                        sourceRhinoChain,
                        destRhinoChain,
                        tokenSymbol,
                        setTransactions,
                        setReceiveAmount,
                        setFeeUsd,
                        setEstimatedGasCostUsd,
                        setIsFeeEstimationError,
                        setQuoteExpiresAt,
                        setCommitmentId,
                    })
                    setPath('bridge')
                    return
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
                setPath('sda')
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
        path,
        quoteExpiresAt,
        commitmentId,
        isQuoteExpired,
        pollBridgeStatus,
        calculate,
        reset,
    }
}

interface BridgePathParams {
    source: CrossChainSourceInfo
    destination: CrossChainDestinationInfo
    sourceRhinoChain: string
    destRhinoChain: string
    tokenSymbol: string
    setTransactions: (tx: PreparedTransaction[] | null) => void
    setReceiveAmount: (v: string | null) => void
    setFeeUsd: (v: number | undefined) => void
    setEstimatedGasCostUsd: (v: number | undefined) => void
    setIsFeeEstimationError: (v: boolean) => void
    setQuoteExpiresAt: (v: string | null) => void
    setCommitmentId: (v: string | null) => void
}

/**
 * Bridge path: quote → commit → calldata. Used for non-stablecoin tokenOut
 * (ETH, WETH, etc.) where Rhino's SDA primitive rejects with
 * `DepositAddressTokenOutNotSupported`.
 */
async function runBridgePath({
    source,
    destination,
    sourceRhinoChain,
    destRhinoChain,
    tokenSymbol,
    setTransactions,
    setReceiveAmount,
    setFeeUsd,
    setEstimatedGasCostUsd,
    setIsFeeEstimationError,
    setQuoteExpiresAt,
    setCommitmentId,
}: BridgePathParams): Promise<void> {
    // Source is always USDC from the Peanut wallet — symbol-only is enough
    // for Rhino (it resolves the address from its bridge config). For cross-
    // token withdraw, tokenIn=USDC, tokenOut=destination token.
    const quote: BridgeQuoteResponse = await getBridgeQuote({
        amount: destination.tokenAmount,
        tokenIn: 'USDC',
        tokenOut: tokenSymbol,
        chainOut: destRhinoChain,
        recipient: destination.recipientAddress,
        depositor: source.address,
        mode: 'receive', // UI always asks "merchant gets X" — user pays X + fee
    })
    void sourceRhinoChain // chainIn is fixed to ARBITRUM on backend

    const commit: BridgeCommitResponse = await commitBridgeQuote(quote.quoteId, quote.isSwap)

    if (!commit.contractAddress) {
        throw new Error('Rhino did not return a bridge contract address — cannot construct tx')
    }

    // Rhino's bridge contract pulls USDC via transferFrom — the kernel SA
    // must approve it first. Prepend USDC.approve(bridgeContract, amount)
    // to the batch so it's atomic with the bridge call (same userOp).
    // USDC source amount in base units — quote.amountIn is the decimal pay
    // amount; our source token is always USDC (6 decimals).
    const STABLECOIN_DECIMALS = 6
    const approveAmount = parseUnits(quote.amountIn, STABLECOIN_DECIMALS)
    const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [commit.calldata.to as Address, approveAmount],
    })

    setTransactions([
        {
            to: source.tokenAddress,
            data: approveData,
            value: undefined,
        },
        {
            to: commit.calldata.to as Address,
            data: commit.calldata.data as Hex,
            value: commit.calldata.value ? BigInt(commit.calldata.value) : undefined,
        },
    ])
    setReceiveAmount(quote.amountOut)
    setFeeUsd(quote.feeUsd + quote.gasFeeUsd)
    setEstimatedGasCostUsd(0) // gas paid by paymaster — same as SDA path
    setIsFeeEstimationError(false)
    setQuoteExpiresAt(quote.expiresAt)
    setCommitmentId(commit.commitmentId)
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
