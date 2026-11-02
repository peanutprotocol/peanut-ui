'use client'

import { useCallback, useRef, useState } from 'react'
import type { Address } from 'viem'
import { pad, parseAbi, toFunctionSelector } from 'viem'
import { useQueryClient } from '@tanstack/react-query'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useAuth } from '@/context/authContext'
import { useKernelClient } from '@/context/kernelClient.context'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { fundingAccessQueryKey } from '@/hooks/useCardFundingAccess'
import { rainCoordinatorAbi } from '@/constants/rain.consts'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { toCallPolicy, CallPolicyVersion, ParamCondition } from '@zerodev/permissions/policies'
import { rainApi, type RainFundingAccess } from '@/services/rain'
import { API_ERROR_CODES, wireErrorCode } from '@/services/api-error'
import { useZeroDev } from '@/hooks/useZeroDev'
import { signKernelPermission, PermissionWalletMismatchError } from '@/hooks/wallet/signKernelPermission'
import { sameIdentity, type CardFlowIdentity } from '@/utils/rain-funding.utils'

/**
 * One-time session-key grant for Rain card operations, in a single passkey
 * tap. What it installs follows the server's funding decision, read fresh
 * right before signing; no caller chooses it:
 *   - `managed` (the server's persisted decision for this wallet): one entry,
 *     `coordinator.withdrawAsset(coordinator, *)`, for user-initiated
 *     withdrawals only. Card payments are funded by the separate approve-only
 *     permission (`useRainFunding`).
 *   - `legacy` (every other account, including one that could enroll but has
 *     not accepted): the existing card permission, one call policy that
 *     allows `USDC.transfer(collateralProxy, *)` for automatic card top-ups
 *     OR `coordinator.withdrawAsset`.
 *
 * Per-spend authorization of a withdrawal still comes from the user via the
 * admin EIP-712 signature (which the coordinator verifies against the kernel
 * via ERC-1271). An unreadable decision, or an account or wallet switch
 * during the flow, signs nothing.
 *
 * Consumers: Home's card permission prompt, legacy card re-issue
 * (`serializeGrant`), dev grant page, the stale-approval re-enable modal,
 * permission repair, and `spendPreflight` for the lazy "first collateral
 * spend prompts for grant" flow.
 */

export type GrantSessionKeyError =
    | { kind: 'no-card' }
    | { kind: 'no-contracts' }
    | { kind: 'session-key-unavailable'; message: string }
    | { kind: 'user-cancelled' }
    /** The funding decision could not be read. Nothing was signed. */
    | { kind: 'access-unavailable'; message: string }
    /** The account or wallet changed during the flow. Nothing further was signed or sent. */
    | { kind: 'account-changed' }
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
    /** Passkey tap only — returns the serialized approval without submitting
     *  it. For a legacy card re-issue, where the application carries it.
     *  `expected` is the user and wallet the calling flow started for. */
    serializeGrant: (
        expected?: CardFlowIdentity
    ) => Promise<{ ok: true; serialized: string } | { ok: false; error: GrantSessionKeyError }>
    isGranting: boolean
    lastError: GrantSessionKeyError | null
}

/** The policy entries a session-key grant installs for this funding decision. */
const grantPermissions = (
    access: RainFundingAccess,
    coordinatorAddress: Address,
    collateralProxy: Address | undefined
) => {
    const withdraw = { target: coordinatorAddress, selector: toFunctionSelector(rainCoordinatorAbi[0]) }
    if (access.fundingMode === 'managed') return [withdraw]
    if (!collateralProxy) return null
    // `params` is bytes32[] even for a single EQUAL rule; pad the address to 32 bytes.
    const topUp = {
        target: PEANUT_WALLET_TOKEN as Address,
        selector: toFunctionSelector(parseAbi(['function transfer(address,uint256) returns (bool)'])[0]),
        rules: [{ condition: ParamCondition.EQUAL, offset: 0, params: [pad(collateralProxy, { size: 32 })] }],
    }
    // One call policy with both entries: either call is allowed (separate
    // policies would be AND'd).
    return [topUp, withdraw]
}

export const useGrantSessionKey = (): GrantSessionKeyResult => {
    const queryClient = useQueryClient()
    const { user } = useAuth()
    const userId = user?.user?.userId
    const { overview, refetch } = useRainCardOverview()
    const { ensureClientForChain, getPatchedSudoValidator, rebuildClientForChain } = useKernelClient()
    const { handleSendUserOpEncoded, address: connectedAddress } = useZeroDev()
    const [isGranting, setIsGranting] = useState(false)
    const [lastError, setLastError] = useState<GrantSessionKeyError | null>(null)
    // Latest identity, read after every await: a switch signs and sends nothing further.
    const identityRef = useRef({ userId, connectedAddress })
    identityRef.current = { userId, connectedAddress }

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
    const runSerialize = useCallback(
        async (
            startedFor: CardFlowIdentity
        ): Promise<{ ok: true; serialized: string } | { ok: false; error: GrantSessionKeyError }> => {
            const changed = () => !sameIdentity(identityRef.current, startedFor)
            const accountChanged = { ok: false, error: { kind: 'account-changed' } } as const

            // Nothing is signed for a wallet that is not known yet: an unknown
            // start gives the signer no wallet to hold the kernel to. The
            // address is published once the wallet is up, so bring it up here
            // (signing nothing; this is also the retry after a failed
            // initialization) and let the next tap sign for the known wallet.
            if (!startedFor.connectedAddress) {
                await ensureClientForChain(PEANUT_WALLET_CHAIN.id.toString())
                return { ok: false, error: { kind: 'unexpected', message: 'Wallet not ready yet' } }
            }

            const fresh = await refetch()
            if (changed()) return accountChanged
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
            const collateralProxy = fresh.data.status?.contractAddress as Address | undefined
            if (!coordinatorAddress) {
                return { ok: false, error: { kind: 'no-contracts' } }
            }

            // The funding decision, read fresh: it alone picks what is installed.
            let access: RainFundingAccess
            try {
                access = await rainApi.getFundingAccess()
            } catch (e) {
                if (changed()) return accountChanged
                return { ok: false, error: { kind: 'access-unavailable', message: (e as Error).message } }
            }
            if (changed()) return accountChanged
            queryClient.setQueryData(fundingAccessQueryKey(startedFor), access)
            const permissions = grantPermissions(access, coordinatorAddress, collateralProxy)
            if (!permissions) return { ok: false, error: { kind: 'no-contracts' } }

            let sessionKeyAddress: Address
            try {
                const { address } = await rainApi.getSessionKeyAddress()
                sessionKeyAddress = address as Address
            } catch (e) {
                return { ok: false, error: { kind: 'session-key-unavailable', message: (e as Error).message } }
            }
            if (changed()) return accountChanged

            // No param rules on withdrawAsset: the per-spend admin EIP-712
            // signature the user produces via passkey gates recipient/amount on
            // every call.
            const rainCallPolicy = await toCallPolicy({ policyVersion: CallPolicyVersion.V0_0_4, permissions })
            if (changed()) return accountChanged

            let serialized: string
            try {
                serialized = await signKernelPermission({
                    policies: [rainCallPolicy],
                    sessionKeyAddress,
                    // The kernel the signer prepares must be the wallet this
                    // flow started with, and the user and wallet must still be
                    // current before each passkey ceremony.
                    expectedAccount: startedFor.connectedAddress as Address,
                    isCurrent: () => !changed(),
                    kernel: { ensureClientForChain, getPatchedSudoValidator, rebuildClientForChain },
                    sendUserOp: handleSendUserOpEncoded,
                })
            } catch (e) {
                if (e instanceof PermissionWalletMismatchError) return accountChanged
                throw e
            }
            if (changed()) return accountChanged
            return { ok: true, serialized }
        },
        [
            refetch,
            queryClient,
            ensureClientForChain,
            getPatchedSudoValidator,
            handleSendUserOpEncoded,
            rebuildClientForChain,
        ]
    )

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

            const startedFor = identityRef.current
            const r = await runSerialize(startedFor)
            if (!r.ok) return r
            // An approval signed for one account is never sent under another's session.
            if (!sameIdentity(identityRef.current, startedFor)) {
                return { ok: false, error: { kind: 'account-changed' } as const }
            }

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
            // The approval is stored for the account that signed it; a switch
            // since then refreshes nothing for the next one.
            if (!sameIdentity(identityRef.current, startedFor)) {
                return { ok: false, error: { kind: 'account-changed' } as const }
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

    const serializeGrant = useCallback<GrantSessionKeyResult['serializeGrant']>(
        async (expected) => {
            // Handed over from another flow for one account and wallet: for any
            // other it reads, prompts and signs nothing.
            if (expected && !sameIdentity(identityRef.current, expected)) {
                return { ok: false, error: { kind: 'account-changed' } }
            }
            const startedFor = identityRef.current
            const result = await wrap(async () => {
                const r = await runSerialize(startedFor)
                return r.ok ? { ok: true, value: r.serialized } : r
            })
            if (result.ok) return { ok: true, serialized: result.value as string }
            return result
        },
        [wrap, runSerialize]
    )

    return { grant, serializeGrant, isGranting, lastError }
}
