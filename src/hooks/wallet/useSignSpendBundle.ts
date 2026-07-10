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
import { ensureRootValidatorMigrated, isMigrationWrapperAccount } from '@/utils/kernelMigration.utils'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useModalsContextOptional } from '@/context/ModalsContext'
import { rainApi, type RainCollateralKind } from '@/services/rain'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { useRainCardOverview, RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import { useGrantSessionKey, type GrantSessionKeyError } from './useGrantSessionKey'
import { useSignUserOp, type SignedUserOpData } from './useSignUserOp'
import {
    computeSpendStrategy,
    fetchLiveSmartUsdcBalance,
    InsufficientSpendableError,
    SessionKeyGrantRequiredError,
    type SpendStrategy,
} from './useSpendBundle'
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
            const { requiredUsdcAmount, recipient, rainSpendingPower, kind, onStrategyDecided, onGrantRequired } = input

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
            const smartBalance = await fetchLiveSmartUsdcBalance(queryClient, kernelAccount.address)

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
                // Passed the FE display gate but the live balance can't cover it yet
                // (in-transit collateral not landed / ~30s-stale FE). Refresh the Rain
                // overview so the displayed balance + a retry reflect reality.
                queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] })
                throw new InsufficientSpendableError()
            }

            onStrategyDecided?.(strategy)
            posthog.capture(ANALYTICS_EVENTS.CARD_WITHDRAW_ATTEMPTED, { strategy, kind, flow: 'sign-only' })

            // Pre-flight #1 — root-validator migration (pre-2025-09-18 accounts
            // only). The mixed path pre-signs the admin EIP-712 AND a userOp the
            // backend submits later; on an unmigrated account that userOp is
            // migration-wrapped, and the migration swaps the root validator
            // before `withdrawAsset` verifies the (old-validator-routed) admin
            // sig via ERC-1271 — the op always reverts ("Delegatecall failed").
            // Migrate first as its own userOp, then re-resolve the account so
            // every signature below routes to v0.0.3. Overlay = same intentional
            // beat as useSpendBundle's mixed path. collateral-only is exempt:
            // its session-key submission never re-wraps a migration around the
            // admin sig.
            let activeAccount = kernelAccount
            if (strategy === 'mixed' && isMigrationWrapperAccount(kernelAccount)) {
                modals?.setIsSecurityVerificationOpen?.(true)
                try {
                    const activeClient = await ensureRootValidatorMigrated({
                        client: kernelClient,
                        sendNoopUserOp: (call) => handleSendUserOpEncoded([call], chainIdStr),
                        rebuildClient: () => rebuildClientForChain(chainIdStr),
                        onEvent: (event) =>
                            posthog.capture(
                                event === 'attempted'
                                    ? ANALYTICS_EVENTS.KERNEL_MIGRATION_ATTEMPTED
                                    : ANALYTICS_EVENTS.KERNEL_MIGRATION_SUCCEEDED,
                                { trigger: 'sign-spend', kind }
                            ),
                    })
                    if (!activeClient.account) {
                        throw new Error('useSignSpendBundle: rebuilt kernel account not initialized')
                    }
                    activeAccount = activeClient.account
                } finally {
                    modals?.setIsSecurityVerificationOpen?.(false)
                }
            }

            // Pre-flight #2: any strategy that touches Rain collateral requires
            // the one-time session-key grant. If missing, run the inline grant
            // flow now. Reject when the overview hasn't loaded yet — we can't
            // tell whether the grant was already given, and signing
            // optimistically would crash on the backend submission.
            const touchesCollateral = strategy === 'collateral-only' || strategy === 'mixed'
            if (touchesCollateral) {
                if (!overview) {
                    throw new SessionKeyGrantRequiredError({ kind: 'unexpected' } as GrantSessionKeyError)
                }
                const card = findActiveCard(overview)
                if (card && !card.hasWithdrawApproval) {
                    onGrantRequired?.()
                    const grantResult = await grant()
                    if (!grantResult.ok) {
                        throw new SessionKeyGrantRequiredError(grantResult.error as GrantSessionKeyError)
                    }
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
