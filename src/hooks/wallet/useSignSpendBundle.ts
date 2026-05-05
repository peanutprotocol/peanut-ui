'use client'

import { useCallback } from 'react'
import type { Address, Hex } from 'viem'
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
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useGrantSessionKey, type GrantSessionKeyError } from './useGrantSessionKey'
import { useSignUserOp, type SignedUserOpData } from './useSignUserOp'
import {
    computeSpendStrategy,
    InsufficientSpendableError,
    SessionKeyGrantRequiredError,
    type SpendStrategy,
} from './useSpendBundle'

/**
 * Wire payload for a Rain withdrawal that the backend will broadcast (via
 * session-key UserOp) AFTER its precondition succeeds (e.g. Manteca order
 * created). Mirrors `/rain/cards/withdraw/submit`'s body.
 */
export interface SignedRainWithdrawal {
    preparationId: string
    amount: string
    recipientAddress: Address
    directTransfer: boolean
    adminSalt: Hex
    adminNonce: string
    adminSignature: Hex
    executorSignature: string
    executorSalt: string
    expiresAt: number
}

export type SignedSpendArtifact =
    | {
          strategy: 'smart-only'
          /** Single-transfer USDC UserOp from the smart account. Backend broadcasts. */
          signedUserOp: SignedUserOpData
      }
    | {
          strategy: 'mixed'
          /** Batch UserOp `[withdrawAsset, transfer]` from the smart account. Backend broadcasts. */
          signedUserOp: SignedUserOpData
          /** TransactionIntent id created by `/rain/cards/withdraw/prepare`.
           *  Backend echoes / stamps this so the Rain webhook reconciles correctly. */
          rainPreparationId: string
      }
    | {
          strategy: 'collateral-only'
          /** Backend submits this directly via the user's session-key UserOp on the
           *  Rain coordinator (`directTransfer=true` straight to the recipient). */
          rainWithdrawal: SignedRainWithdrawal
      }

export interface SignSpendBundleInput {
    /** Total USDC (token smallest units) the spend must deliver. */
    requiredUsdcAmount: bigint
    /** Final recipient — required (Manteca-style flows always have a fixed destination). */
    recipient: Address
    /** Smart-account USDC balance right now, in token smallest units. */
    smartBalance: bigint
    /** Rain collateral `spendingPower` right now, in token smallest units. */
    rainSpendingPower: bigint
    /** User-semantic category of this spend (QR_PAY, FIAT_OFFRAMP, …).
     *  Persisted on the `TransactionIntent` the backend creates in /prepare. */
    kind: TransactionIntentKind
    /** Fires once routing is picked, before any signing. */
    onStrategyDecided?: (strategy: Exclude<SpendStrategy, 'insufficient'>) => void
    /** Fires right before the one-time session-key grant prompt appears. */
    onGrantRequired?: () => void
}

/**
 * Sign-only sibling of `useSpendBundle`. Picks a strategy
 * (collateral-only / smart-only / mixed) and returns the signed artifacts
 * WITHOUT broadcasting. Designed for Manteca's sign-then-broadcast pattern,
 * where the backend gates the broadcast on creating the Manteca order first.
 *
 * Strategies map to backend behaviour:
 * - smart-only: backend broadcasts the signed UserOp via the bundler.
 * - mixed: backend broadcasts the signed UserOp (which atomically pulls
 *   collateral and forwards the full amount to the recipient).
 * - collateral-only: backend submits the signed Rain withdrawal directly via
 *   the user's session-key UserOp, with `directTransfer=true` so Rain's
 *   coordinator transfers from the collateral proxy straight to the recipient
 *   (1 passkey tap total — admin EIP-712 only).
 *
 * Conversion note: Rain's coordinator takes amounts in cents (2dp), our
 * internal representation is USDC wei (6dp). We round up so a sub-cent
 * shortfall still withdraws at least one cent.
 */
function usdcWeiToRainCents(amountWei: bigint): bigint {
    if (amountWei <= 0n) return 0n
    const divisor = 10n ** BigInt(PEANUT_WALLET_TOKEN_DECIMALS - 2)
    return (amountWei + divisor - 1n) / divisor
}

export const useSignSpendBundle = () => {
    const { getClientForChain } = useKernelClient()
    const { signCallsUserOp } = useSignUserOp()
    const { user } = useAuth()
    const { overview } = useRainCardOverview()
    const { grant } = useGrantSessionKey()

    const signSpend = useCallback(
        async (input: SignSpendBundleInput): Promise<SignedSpendArtifact> => {
            const {
                requiredUsdcAmount,
                recipient,
                smartBalance,
                rainSpendingPower,
                kind,
                onStrategyDecided,
                onGrantRequired,
            } = input

            // Manteca-style flows always have a single recipient and no
            // subsequent kernel calls — collateral-only is always eligible.
            const strategy = computeSpendStrategy({
                smart: smartBalance,
                rain: rainSpendingPower,
                amount: requiredUsdcAmount,
                collateralOnlyAllowed: true,
            })
            if (strategy === 'insufficient') {
                posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_FAILED, {
                    strategy: 'insufficient',
                    error_kind: 'insufficient',
                    flow: 'sign-only',
                })
                throw new InsufficientSpendableError()
            }

            onStrategyDecided?.(strategy)
            posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_ATTEMPTED, { strategy, kind, flow: 'sign-only' })

            const chainIdNum = PEANUT_WALLET_CHAIN.id
            const chainIdStr = chainIdNum.toString()

            // Pre-flight: any strategy that touches Rain collateral requires
            // the one-time session-key grant. If missing, run the inline grant
            // flow now.
            const touchesCollateral = strategy === 'collateral-only' || strategy === 'mixed'
            const card = overview?.cards?.[0]
            if (touchesCollateral && card && !card.hasWithdrawApproval) {
                onGrantRequired?.()
                const grantResult = await grant()
                if (!grantResult.ok) {
                    throw new SessionKeyGrantRequiredError(grantResult.error as GrantSessionKeyError)
                }
            }

            // ─── smart-only ─────────────────────────────────────────────────
            if (strategy === 'smart-only') {
                const transferData = encodeFunctionData({
                    abi: erc20Abi,
                    functionName: 'transfer',
                    args: [recipient, requiredUsdcAmount],
                })
                const signedUserOp = await signCallsUserOp(
                    [{ to: PEANUT_WALLET_TOKEN as Hex, value: 0n, data: transferData }],
                    chainIdStr
                )
                return { strategy, signedUserOp }
            }

            // ─── collateral-only ────────────────────────────────────────────
            // Only sign the admin EIP-712 — backend submits the withdrawal via
            // the user's session-key UserOp (1 tap total).
            if (strategy === 'collateral-only') {
                const prep = await rainApi.prepareWithdrawal({
                    amount: usdcWeiToRainCents(requiredUsdcAmount).toString(),
                    recipientAddress: recipient,
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

                return {
                    strategy,
                    rainWithdrawal: {
                        preparationId: prep.preparationId,
                        amount: prep.amount,
                        recipientAddress: prep.recipientAddress as Address,
                        directTransfer: prep.directTransfer,
                        adminSalt: prep.adminSalt as Hex,
                        adminNonce: prep.adminNonce,
                        adminSignature,
                        executorSignature: prep.executorSignature,
                        executorSalt: prep.executorSalt,
                        expiresAt: prep.expiresAt,
                    },
                }
            }

            // ─── mixed ──────────────────────────────────────────────────────
            // Pull the shortfall from collateral into the smart account, then
            // forward the full amount to the recipient — one atomic UserOp,
            // signed without broadcasting. Two passkey taps (admin sig + UserOp).
            const adminAddress = user?.accounts.find((a) => a.type === AccountType.PEANUT_WALLET)?.identifier as
                | Address
                | undefined
            if (!adminAddress) throw new Error('useSignSpendBundle: missing peanut-wallet address for mixed spend')

            const shortfall = requiredUsdcAmount - smartBalance
            const prep = await rainApi.prepareWithdrawal({
                amount: usdcWeiToRainCents(shortfall).toString(),
                // directTransfer=false sends tokens to the admin (kernel). Same
                // semantics as broadcasting useSpendBundle.spend's mixed path.
                recipientAddress: adminAddress,
                directTransfer: false,
                kind,
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

            const withdrawCall = {
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

            const transferCall = {
                to: PEANUT_WALLET_TOKEN as Hex,
                value: 0n,
                data: encodeFunctionData({
                    abi: erc20Abi,
                    functionName: 'transfer',
                    args: [recipient, requiredUsdcAmount],
                }),
            }

            const signedUserOp = await signCallsUserOp([withdrawCall, transferCall], chainIdStr)
            return { strategy, signedUserOp, rainPreparationId: prep.preparationId }
        },
        [getClientForChain, signCallsUserOp, user, overview, grant]
    )

    return { signSpend }
}
