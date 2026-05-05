'use client'

import { useCallback } from 'react'
import type { Address, Hash, Hex, TransactionReceipt } from 'viem'
import { encodeFunctionData, erc20Abi } from 'viem'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useKernelClient } from '@/context/kernelClient.context'
import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import {
    RAIN_WITHDRAW_EIP712_DOMAIN_NAME,
    RAIN_WITHDRAW_EIP712_DOMAIN_VERSION,
    rainCoordinatorAbi,
    rainWithdrawEip712Types,
} from '@/constants/rain.consts'
import { rainApi, type TransactionIntentKind } from '@/services/rain'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useGrantSessionKey, type GrantSessionKeyError } from './useGrantSessionKey'

export type SpendStrategy = 'collateral-only' | 'smart-only' | 'mixed' | 'insufficient'

type UserOpEncodedParams = { to: Hex; value: bigint; data: Hex }

export interface SpendBundleInput {
    /** Total USDC (token smallest units) that must arrive / be available for the spend. */
    requiredUsdcAmount: bigint
    /** Final recipient — required when the whole spend is a plain transfer.
     *  Pass `undefined` for flows whose `subsequentCalls` already handle delivery
     *  (e.g. Peanut link creation `approve + makeDeposit`). */
    recipient?: Address
    /** Smart-account USDC balance right now, in token smallest units. */
    smartBalance: bigint
    /** Rain collateral `spendingPower` right now, in token smallest units. */
    rainSpendingPower: bigint
    /** User-semantic category of this spend (P2P_SEND, QR_PAY, CRYPTO_WITHDRAW, …).
     *  Persisted on the `TransactionIntent` the backend creates in /prepare, so
     *  the Rain collateral webhook can be reconciled and categorized correctly
     *  in history (instead of showing up as a generic "card payment"). */
    kind: TransactionIntentKind
    /** Extra calls to include in the kernel UserOp (for approve+deposit-style flows).
     *  If present, collateral-only routing is NOT eligible — calls must run from the kernel. */
    subsequentCalls?: UserOpEncodedParams[]
    /** Fires once the routing is picked, before any signing — lets the caller update UI
     *  (e.g. show "this will take 2 taps"). */
    onStrategyDecided?: (strategy: Exclude<SpendStrategy, 'insufficient'>) => void
    /** Fires right before the one-time session-key grant prompt appears (only when
     *  the chosen strategy touches Rain collateral and approval is missing). Lets
     *  the caller show UI explaining the extra tap before the WebAuthn sheet. */
    onGrantRequired?: () => void
}

export interface SpendBundleResult {
    strategy: Exclude<SpendStrategy, 'insufficient'>
    /** Set when the final submission was a plain EVM tx (collateral-only). */
    txHash?: Hex
    /** Set when the final submission was a kernel UserOp (smart-only or mixed). */
    userOpHash?: Hash
    /** On-chain receipt when the kernel path returned one. Null on the
     *  collateral-only path (backend EVM tx; caller can look up the receipt
     *  from `txHash` if needed). */
    receipt?: TransactionReceipt | null
    /** Backend TransactionIntent id (only when strategy touched Rain: collateral-only
     *  or mixed). Use this to navigate to `/receipt/<intentId>?t=<TRANSACTION_INTENT number>`.
     *  Undefined for smart-only — no intent is created for pure smart-account sends. */
    intentId?: string
}

export class InsufficientSpendableError extends Error {
    constructor() {
        super('Insufficient spendable balance')
        this.name = 'InsufficientSpendableError'
    }
}

/**
 * Thrown when the user is about to spend from Rain collateral but hasn't
 * granted the session-key permission yet, and the inline grant either failed
 * or the user cancelled the passkey. Caller can surface a friendlier UI.
 */
export class SessionKeyGrantRequiredError extends Error {
    constructor(public readonly cause: GrantSessionKeyError) {
        super(`Session-key grant required: ${cause.kind}`)
        this.name = 'SessionKeyGrantRequiredError'
    }
}

/**
 * Rain's `/signatures/withdrawals` API, the EIP-712 `Withdraw` message it
 * signs, and the on-chain `coordinator.withdrawAsset` all take `amount` in
 * **cents** (2 decimals) — Rain's sample V2 code calls the field
 * `amountInCents`. Our internal representation is USDC wei (token decimals,
 * typically 6). Convert at the Rain boundary, rounding up so a sub-cent
 * shortfall still withdraws at least one cent.
 */
function usdcWeiToRainCents(amountWei: bigint): bigint {
    if (amountWei <= 0n) return 0n
    const divisor = 10n ** BigInt(PEANUT_WALLET_TOKEN_DECIMALS - 2)
    return (amountWei + divisor - 1n) / divisor
}

/**
 * Pure routing helper — decides which bucket(s) a spend will pull from.
 * Priority: collateral → smart → mixed. Collateral-only requires a single
 * recipient AND no subsequent kernel calls (Rain's coordinator transfers
 * tokens directly; nothing follows).
 */
export function computeSpendStrategy(input: {
    smart: bigint
    rain: bigint
    amount: bigint
    collateralOnlyAllowed: boolean
}): SpendStrategy {
    if (input.collateralOnlyAllowed && input.rain >= input.amount) return 'collateral-only'
    if (input.smart >= input.amount) return 'smart-only'
    if (input.smart + input.rain >= input.amount) return 'mixed'
    return 'insufficient'
}

/**
 * Orchestrates a USDC outflow across the user's two buckets:
 *   - collateral-only: backend broadcasts `coordinator.withdrawAsset(directTransfer=true)`
 *     straight to the recipient. User taps passkey once (admin EIP-712).
 *   - smart-only: existing kernel UserOp path (1 passkey tap).
 *   - mixed: backend prepares a withdraw-to-smart; frontend signs admin EIP-712 (tap #1),
 *     then sends a single UserOp that bundles `[withdrawAsset(directTransfer=false),
 *     usdc.transfer(recipient), ...subsequentCalls]` (tap #2). Atomic.
 *
 * See plan file for the full rationale.
 */
export const useSpendBundle = () => {
    const { getClientForChain } = useKernelClient()
    const { handleSendUserOpEncoded } = useZeroDev()
    const { user } = useAuth()
    const { overview } = useRainCardOverview()
    const { grant } = useGrantSessionKey()

    const spend = useCallback(
        async (input: SpendBundleInput): Promise<SpendBundleResult> => {
            const {
                requiredUsdcAmount,
                recipient,
                subsequentCalls = [],
                smartBalance,
                rainSpendingPower,
                kind,
                onStrategyDecided,
                onGrantRequired,
            } = input

            const hasSubsequent = subsequentCalls.length > 0
            const collateralOnlyAllowed = !hasSubsequent && !!recipient

            const strategy = computeSpendStrategy({
                smart: smartBalance,
                rain: rainSpendingPower,
                amount: requiredUsdcAmount,
                collateralOnlyAllowed,
            })
            if (strategy === 'insufficient') {
                posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_FAILED, {
                    strategy: 'insufficient',
                    error_kind: 'insufficient',
                })
                throw new InsufficientSpendableError()
            }

            onStrategyDecided?.(strategy)
            posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_ATTEMPTED, { strategy, kind })

            try {
                const chainIdNum = PEANUT_WALLET_CHAIN.id
                const chainIdStr = chainIdNum.toString()

                // Pre-flight: any strategy that touches Rain collateral requires
                // the one-time session-key grant. If missing, run the inline grant
                // flow now (one extra passkey tap the FIRST time, zero after).
                const touchesCollateral = strategy === 'collateral-only' || strategy === 'mixed'
                const card = overview?.cards?.[0]
                if (touchesCollateral && card && !card.hasWithdrawApproval) {
                    onGrantRequired?.()
                    const grantResult = await grant()
                    if (!grantResult.ok) {
                        throw new SessionKeyGrantRequiredError(grantResult.error)
                    }
                    // `grant()` refetches the overview; by the time we continue the
                    // flag is flipped and the backend will accept the submit call.
                }

                // ─── collateral-only ──────────────────────────────────────────────
                if (strategy === 'collateral-only') {
                    const prep = await rainApi.prepareWithdrawal({
                        amount: usdcWeiToRainCents(requiredUsdcAmount).toString(),
                        recipientAddress: recipient!,
                        directTransfer: true,
                        kind,
                    })

                    const kernelClient = getClientForChain(chainIdStr)
                    const adminSignature = (await kernelClient.account!.signTypedData({
                        domain: {
                            name: RAIN_WITHDRAW_EIP712_DOMAIN_NAME,
                            version: RAIN_WITHDRAW_EIP712_DOMAIN_VERSION,
                            chainId: chainIdNum,
                            verifyingContract: prep.collateralProxy as Address,
                            salt: prep.adminSalt as Hex,
                        },
                        types: rainWithdrawEip712Types,
                        primaryType: 'Withdraw',
                        message: {
                            user: prep.adminAddress as Address,
                            asset: prep.tokenAddress as Address,
                            amount: BigInt(prep.amount),
                            recipient: prep.recipientAddress as Address,
                            nonce: BigInt(prep.adminNonce),
                        },
                    })) as Hex

                    const { txHash } = await rainApi.submitWithdrawal({
                        preparationId: prep.preparationId,
                        amount: prep.amount,
                        recipientAddress: prep.recipientAddress,
                        directTransfer: prep.directTransfer,
                        adminSalt: prep.adminSalt,
                        adminNonce: prep.adminNonce,
                        adminSignature,
                        executorSignature: prep.executorSignature,
                        executorSalt: prep.executorSalt,
                        expiresAt: prep.expiresAt,
                    })
                    posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_SUCCEEDED, { strategy, kind })
                    return { strategy, txHash: txHash as Hex, intentId: prep.preparationId }
                }

                // ─── smart-only ──────────────────────────────────────────────────
                if (strategy === 'smart-only') {
                    const calls: UserOpEncodedParams[] = []
                    if (recipient) {
                        calls.push({
                            to: PEANUT_WALLET_TOKEN as Hex,
                            value: 0n,
                            data: encodeFunctionData({
                                abi: erc20Abi,
                                functionName: 'transfer',
                                args: [recipient, requiredUsdcAmount],
                            }),
                        })
                    }
                    calls.push(...subsequentCalls)
                    if (calls.length === 0) {
                        throw new Error('useSpendBundle: smart-only path needs either recipient or subsequentCalls')
                    }
                    const { userOpHash, receipt } = await handleSendUserOpEncoded(calls, chainIdStr)
                    posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_SUCCEEDED, { strategy, kind })
                    return { strategy, userOpHash, receipt }
                }

                // ─── mixed ───────────────────────────────────────────────────────
                // Pull the shortfall from collateral into the smart account, then
                // the kernel fires the USDC transfer + any subsequent calls — all in
                // one atomic UserOp. Two passkey taps total (admin sig, UserOp).

                // Admin address = user's peanut-wallet address (kernel smart account).
                const adminAddress = user?.accounts.find((a) => a.type === AccountType.PEANUT_WALLET)?.identifier as
                    | Address
                    | undefined
                if (!adminAddress) throw new Error('useSpendBundle: missing peanut-wallet address for mixed spend')

                const shortfall = requiredUsdcAmount - smartBalance
                const prep = await rainApi.prepareWithdrawal({
                    amount: usdcWeiToRainCents(shortfall).toString(),
                    // directTransfer=false sends tokens to the admin (kernel). We still pass
                    // the admin address here; the backend + coordinator treat it as the
                    // withdraw beneficiary, which equals msg.sender-to-be in the follow-up UserOp.
                    recipientAddress: adminAddress,
                    directTransfer: false,
                    kind,
                    // History shows the full user-initiated spend, not just the
                    // shortfall Rain signed over.
                    totalAmountCents: usdcWeiToRainCents(requiredUsdcAmount).toString(),
                })

                const kernelClient = getClientForChain(chainIdStr)
                const adminSignature = (await kernelClient.account!.signTypedData({
                    domain: {
                        name: RAIN_WITHDRAW_EIP712_DOMAIN_NAME,
                        version: RAIN_WITHDRAW_EIP712_DOMAIN_VERSION,
                        chainId: chainIdNum,
                        verifyingContract: prep.collateralProxy as Address,
                        salt: prep.adminSalt as Hex,
                    },
                    types: rainWithdrawEip712Types,
                    primaryType: 'Withdraw',
                    message: {
                        user: prep.adminAddress as Address,
                        asset: prep.tokenAddress as Address,
                        amount: BigInt(prep.amount),
                        recipient: prep.recipientAddress as Address,
                        nonce: BigInt(prep.adminNonce),
                    },
                })) as Hex

                // Backend `/prepare` normalizes the executor salt (bytes32) and signature
                // to 0x-hex regardless of what Rain returned — trust the wire shape here.
                const withdrawCall: UserOpEncodedParams = {
                    to: prep.coordinatorAddress as Hex,
                    value: 0n,
                    data: encodeFunctionData({
                        abi: rainCoordinatorAbi,
                        functionName: 'withdrawAsset',
                        args: [
                            prep.collateralProxy as Address,
                            prep.tokenAddress as Address,
                            BigInt(prep.amount),
                            prep.recipientAddress as Address,
                            BigInt(prep.expiresAt),
                            prep.executorSalt as Hex,
                            prep.executorSignature as Hex,
                            [prep.adminSalt as Hex],
                            [adminSignature],
                            prep.directTransfer,
                        ],
                    }),
                }

                const transferCall: UserOpEncodedParams | null = recipient
                    ? {
                          to: PEANUT_WALLET_TOKEN as Hex,
                          value: 0n,
                          data: encodeFunctionData({
                              abi: erc20Abi,
                              functionName: 'transfer',
                              args: [recipient, requiredUsdcAmount],
                          }),
                      }
                    : null

                const calls: UserOpEncodedParams[] = [
                    withdrawCall,
                    ...(transferCall ? [transferCall] : []),
                    ...subsequentCalls,
                ]
                const { userOpHash, receipt } = await handleSendUserOpEncoded(calls, chainIdStr)

                // Stamp the intent so the Rain collateral webhook reconciles to the
                // right category (P2P_SEND, CRYPTO_WITHDRAW, etc). Non-blocking —
                // a stamp failure leaves the intent PENDING, which only affects
                // history labeling, not the spend itself.
                const mixedTxHash = (receipt?.transactionHash as Hex | undefined) ?? (userOpHash as Hex | undefined)
                if (mixedTxHash) {
                    rainApi.stampWithdrawal({ preparationId: prep.preparationId, txHash: mixedTxHash }).catch(() => {})
                }

                posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_SUCCEEDED, { strategy, kind })
                return { strategy, userOpHash, receipt, intentId: prep.preparationId }
            } catch (e) {
                const errorKind =
                    e instanceof SessionKeyGrantRequiredError
                        ? `session-key:${e.cause.kind}`
                        : ((e as Error)?.name ?? 'unknown')
                posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_FAILED, {
                    strategy,
                    kind,
                    error_kind: errorKind,
                    error_message: (e as Error)?.message,
                })
                throw e
            }
        },
        [getClientForChain, handleSendUserOpEncoded, user, overview, grant]
    )

    return { spend }
}
