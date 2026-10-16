'use client'

import { useCallback, useState } from 'react'
import type { Address } from 'viem'
import { toFunctionSelector } from 'viem'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useKernelClient } from '@/context/kernelClient.context'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { rainCoordinatorAbi } from '@/constants/rain.consts'
import { toCallPolicy, CallPolicyVersion } from '@zerodev/permissions/policies'
import { rainApi } from '@/services/rain'
import { API_ERROR_CODES, wireErrorCode } from '@/services/api-error'
import { useZeroDev } from '@/hooks/useZeroDev'
import { signKernelPermission } from '@/hooks/wallet/signKernelPermission'

/**
 * One-time session-key grant for Rain card operations.
 *
 * Installs one `CallPolicy` entry on the user's kernel in a single
 * passkey tap:
 *   - `coordinator.withdrawAsset(coordinator, *)` — user-initiated withdrawals
 *
 * After the grant, the backend can submit withdrawal UserOps
 * using the shared session key without another passkey tap — per-spend
 * authorization still comes from the user via the admin EIP-712 signature
 * (which the coordinator verifies against the kernel via ERC-1271).
 *
 * This is the WITHDRAWAL permission only. Card payments are funded by a
 * different, approve-only permission (`useRainFunding`); the two have distinct
 * permission ids and coexist on one kernel.
 *
 * Consumers: dev grant page, the stale-approval re-enable modal, and
 * `spendPreflight` for the lazy "first collateral spend prompts for grant" flow.
 */

export type GrantSessionKeyError =
    | { kind: 'no-card' }
    | { kind: 'no-contracts' }
    | { kind: 'session-key-unavailable'; message: string }
    | { kind: 'user-cancelled' }
    /** The grant store refused the approval (400 STALE_CARD_APPROVAL): the
     *  controller moved between this overview read and the save. Kept distinct
     *  from `unexpected` because it is the ONE grant failure a spend may treat
     *  as a rotation candidate — and the re-enable modal can say so. */
    | { kind: 'stale-approval'; message: string }
    | { kind: 'unexpected'; message: string }

export interface GrantSessionKeyResult {
    /** Full grant: passkey tap + POST to `/session-approve`. Requires an
     *  active card; use for the lazy "first collateral spend" flow.
     *  `overviewFresh` is false when the grant itself succeeded but the
     *  follow-up overview refetch failed (react-query refetch resolves with
     *  an error state instead of throwing) — consumers must NOT read the
     *  still-stale `hasWithdrawApproval` as a lockout signal in that case. */
    grant: () => Promise<{ ok: true; overviewFresh: boolean } | { ok: false; error: GrantSessionKeyError }>
    isGranting: boolean
    lastError: GrantSessionKeyError | null
}

export const useGrantSessionKey = (): GrantSessionKeyResult => {
    const { overview, refetch } = useRainCardOverview()
    const { ensureClientForChain, getPatchedSudoValidator, rebuildClientForChain } = useKernelClient()
    const { handleSendUserOpEncoded } = useZeroDev()
    const [isGranting, setIsGranting] = useState(false)
    const [lastError, setLastError] = useState<GrantSessionKeyError | null>(null)

    /**
     * Shared passkey + serialize step. Produces the serialized permission
     * string but does NOT hit any backend endpoint. Requires the coordinator
     * address (available once Rain has approved KYC); the policy targets only it.
     *
     * The coordinator is read from a FRESH overview fetch, never the cached
     * one: it surfaces the latest SERVER metadata, which a failed Rain
     * operation repairs after Rain rotates the controller (TASK-22734). A grant
     * pinned to a stale coordinator is dead on arrival — the backend refuses to
     * store it (400 STALE_CARD_APPROVAL) and every collateral spend would 409.
     */
    const runSerialize = useCallback(async (): Promise<
        { ok: true; serialized: string } | { ok: false; error: GrantSessionKeyError }
    > => {
        const fresh = await refetch()
        if (!fresh.isSuccess || !fresh.data) {
            return {
                ok: false,
                error: {
                    kind: 'unexpected',
                    message: (fresh.error as Error | null)?.message ?? 'Card overview unavailable',
                },
            }
        }
        const coordinatorAddress = fresh.data.status?.coordinatorAddress as Address | undefined
        if (!coordinatorAddress) {
            return { ok: false, error: { kind: 'no-contracts' } }
        }

        let sessionKeyAddress: Address
        try {
            const { address } = await rainApi.getSessionKeyAddress()
            sessionKeyAddress = address as Address
        } catch (e) {
            return { ok: false, error: { kind: 'session-key-unavailable', message: (e as Error).message } }
        }

        // coordinator.withdrawAsset(*) — user-initiated withdrawals. No param
        // rules: the per-spend admin EIP-712 signature the user produces via
        // passkey gates recipient/amount on every call. The session key can
        // move no funds on its own — card payments are funded by the separate
        // approve-only funding permission, not by this grant.
        const rainCallPolicy = await toCallPolicy({
            policyVersion: CallPolicyVersion.V0_0_4,
            permissions: [
                {
                    target: coordinatorAddress,
                    selector: toFunctionSelector(rainCoordinatorAbi[0]),
                },
            ],
        })

        const serialized = await signKernelPermission({
            policies: [rainCallPolicy],
            sessionKeyAddress,
            kernel: { ensureClientForChain, getPatchedSudoValidator, rebuildClientForChain },
            sendUserOp: handleSendUserOpEncoded,
        })
        return { ok: true, serialized }
    }, [refetch, ensureClientForChain, getPatchedSudoValidator, handleSendUserOpEncoded, rebuildClientForChain])

    const wrap = useCallback(
        async <T>(
            run: () => Promise<{ ok: true; value?: T } | { ok: false; error: GrantSessionKeyError }>
        ): Promise<{ ok: true; value?: T } | { ok: false; error: GrantSessionKeyError }> => {
            setIsGranting(true)
            setLastError(null)
            try {
                const result = await run()
                if (result.ok) {
                    posthog.capture(ANALYTICS_EVENTS.CARD_SESSION_KEY_GRANTED)
                } else {
                    setLastError(result.error)
                    posthog.capture(ANALYTICS_EVENTS.CARD_SESSION_KEY_FAILED, { kind: result.error.kind })
                }
                return result
            } catch (err) {
                const message = (err as Error).message ?? String(err)
                const kind: GrantSessionKeyError['kind'] =
                    message.toLowerCase().includes('user rejected') || message.toLowerCase().includes('cancelled')
                        ? 'user-cancelled'
                        : 'unexpected'
                const error: GrantSessionKeyError =
                    kind === 'user-cancelled' ? { kind: 'user-cancelled' } : { kind: 'unexpected', message }
                setLastError(error)
                posthog.capture(ANALYTICS_EVENTS.CARD_SESSION_KEY_FAILED, { kind })
                return { ok: false, error }
            } finally {
                setIsGranting(false)
            }
        },
        []
    )

    const grant = useCallback<GrantSessionKeyResult['grant']>(async () => {
        const result = await wrap(async () => {
            const card = findActiveCard(overview)
            if (!card) return { ok: false, error: { kind: 'no-card' } as const }

            const r = await runSerialize()
            if (!r.ok) return r

            try {
                await rainApi.submitWithdrawSessionApproval({ serializedApproval: r.serialized })
            } catch (e) {
                // Structured code only — the approval we just signed targets a
                // controller the backend no longer has on record.
                const kind =
                    wireErrorCode(e) === API_ERROR_CODES.STALE_CARD_APPROVAL
                        ? 'stale-approval'
                        : ('unexpected' as const)
                return { ok: false, error: { kind, message: (e as Error).message } as const }
            }

            // Flip the `hasWithdrawApproval` flag in UI by refetching overview.
            // refetch() resolves (never throws) with an error state on network
            // failure — surface that so the caller can tell "flag is stale"
            // apart from "flag genuinely didn't flip". No invalidateQueries
            // after it: awaiting the shared query's own refetch already gives
            // every observer the post-grant data.
            const refetchResult = await refetch()
            return { ok: true as const, value: refetchResult.isSuccess }
        })
        if (result.ok) return { ok: true, overviewFresh: result.value === true }
        return result
    }, [wrap, runSerialize, overview, refetch])

    return { grant, isGranting, lastError }
}
