'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Address, Hex } from 'viem'
import { encodeFunctionData, erc20Abi } from 'viem'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useKernelClient } from '@/context/kernelClient.context'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { rainCoordinatorAbi } from '@/constants/rain.consts'
import { buildRainWithdrawTypedData } from '@/utils/rainWithdraw.utils'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useModalsContextOptional } from '@/context/ModalsContext'
import { rainApi, type RainCollateralKind } from '@/services/rain'
import { RAIN_CARD_OVERVIEW_QUERY_KEY, useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useGrantSessionKey } from './useGrantSessionKey'
import { useSignUserOp, type SignedUserOpData } from './useSignUserOp'
import {
    InsufficientSpendableError,
    resolveSpendStrategy,
    runCollateralSpendPreflight,
    type SpendStrategy,
} from './spendPreflight'
import { usdcUnitsToRainCents } from '@/utils/balance.utils'

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
    /** Rain collateral `spendingPower` right now, in token smallest units. */
    rainSpendingPower: bigint
    /** User-semantic category of this spend (QR_PAY, FIAT_OFFRAMP, …).
     *  Persisted on the `TransactionIntent` the backend creates in /prepare. */
    kind: RainCollateralKind
    /** Skip live-balance routing and force this strategy. For flows whose
     *  PURPOSE is moving collateral itself (e.g. returning excess to the
     *  wallet after a limit decrease) — routing would pick smart-only
     *  whenever the smart account covers the amount, a self-transfer no-op.
     *  Affordability is still enforced against `rainSpendingPower`. */
    forceStrategy?: 'collateral-only'
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
 */

export const useSignSpendBundle = () => {
    const { getClientForChain, rebuildClientForChain } = useKernelClient()
    const { handleSendUserOpEncoded } = useZeroDev()
    const modals = useModalsContextOptional()
    const { signCallsUserOp } = useSignUserOp()
    const { overview } = useRainCardOverview()
    const { grant } = useGrantSessionKey()
    const queryClient = useQueryClient()

    const signSpend = useCallback(
        async (input: SignSpendBundleInput): Promise<SignedSpendArtifact> => {
            const {
                requiredUsdcAmount,
                recipient,
                rainSpendingPower,
                kind,
                forceStrategy,
                onStrategyDecided,
                onGrantRequired,
            } = input

            const chainIdNum = PEANUT_WALLET_CHAIN.id
            const chainIdStr = chainIdNum.toString()

            // Resolve the kernel account once for all strategies. The non-null
            // assertion on `client.account` was crash-prone if auth was still
            // hydrating; do the guard once and reuse `account.address` as the
            // canonical admin address (rather than re-deriving from useAuth).
            const kernelClient = getClientForChain(chainIdStr)
            const kernelAccount = kernelClient.account
            if (!kernelAccount) {
                throw new Error('useSignSpendBundle: kernel account not initialized')
            }

            // Route on the LIVE on-chain balance of the exact account that will
            // send the UserOp — never a cached value (see fetchLiveSmartUsdcBalance).
            // A stale, pre-sweep balance routes `smart-only` to an empty account
            // and reverts on-chain (incident #2230).
            // Manteca-style flows always have a single recipient and no
            // subsequent kernel calls — collateral-only is always eligible.
            let strategy: Exclude<SpendStrategy, 'insufficient'>
            let smartBalance = 0n
            if (forceStrategy === 'collateral-only') {
                // Forced path: the caller is deliberately draining collateral, so
                // only the collateral bucket can fund it. Same insufficient
                // handling as resolveSpendStrategy (refresh, fail closed).
                if (rainSpendingPower < requiredUsdcAmount) {
                    queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] })
                    throw new InsufficientSpendableError()
                }
                strategy = 'collateral-only'
            } else {
                ;({ strategy, smartBalance } = await resolveSpendStrategy({
                    queryClient,
                    accountAddress: kernelAccount.address,
                    requiredUsdcAmount,
                    rainSpendingPower,
                    collateralOnlyAllowed: true,
                    flow: 'sign-only',
                }))
            }

            onStrategyDecided?.(strategy)
            posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_ATTEMPTED, { strategy, kind, flow: 'sign-only' })

            // Failure-capture parity with useSpendBundle's catch: without this,
            // a failed migration/grant/signing in the sign-then-broadcast flow
            // emits `attempted` with no terminal event and the funnel lies.
            try {
                // Shared collateral pre-flights (root-validator migration gate +
                // session-key grant) — ONE ordered sequence for both spend engines;
                // see runCollateralSpendPreflight. Every signature below MUST come
                // from the account it returns. requireOverview: this engine can't
                // tell whether the grant exists while the overview is loading, and
                // signing optimistically would crash on the backend submission.
                const activeClient = await runCollateralSpendPreflight({
                    strategy,
                    kind,
                    kernelClient,
                    overview,
                    requireOverview: true,
                    grant,
                    onGrantRequired,
                    sendNoopUserOp: (call) => handleSendUserOpEncoded([call], chainIdStr),
                    rebuildClient: () => rebuildClientForChain(chainIdStr),
                    setSecurityOverlay: modals?.setIsSecurityVerificationOpen,
                    migrationTrigger: 'sign-spend',
                })
                const activeAccount = activeClient.account
                if (!activeAccount) {
                    throw new Error('useSignSpendBundle: kernel account not initialized after preflight')
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
                        amount: usdcUnitsToRainCents(requiredUsdcAmount).toString(),
                        recipientAddress: recipient,
                        directTransfer: true,
                        kind,
                    })

                    const adminSignature = (await activeAccount.signTypedData(
                        buildRainWithdrawTypedData(prep, chainIdNum)
                    )) as Hex

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
                // Use the kernel account's own address as the admin recipient (the
                // address we sign FROM) instead of re-deriving from useAuth.
                const adminAddress = kernelAccount.address as Address

                const shortfall = requiredUsdcAmount - smartBalance
                const prep = await rainApi.prepareWithdrawal({
                    amount: usdcUnitsToRainCents(shortfall).toString(),
                    // directTransfer=false sends tokens to the admin (kernel). Same
                    // semantics as broadcasting useSpendBundle.spend's mixed path.
                    recipientAddress: adminAddress,
                    directTransfer: false,
                    kind,
                    totalAmountCents: usdcUnitsToRainCents(requiredUsdcAmount).toString(),
                })

                const adminSignature = (await activeAccount.signTypedData(
                    buildRainWithdrawTypedData(prep, chainIdNum)
                )) as Hex

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
            } catch (e) {
                posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_FAILED, {
                    strategy,
                    kind,
                    flow: 'sign-only',
                    error_kind: (e as Error)?.name ?? 'unknown',
                    error_message: (e as Error)?.message,
                })
                throw e
            }
        },
        [
            getClientForChain,
            rebuildClientForChain,
            handleSendUserOpEncoded,
            modals,
            signCallsUserOp,
            overview,
            grant,
            queryClient,
        ]
    )

    return { signSpend }
}
