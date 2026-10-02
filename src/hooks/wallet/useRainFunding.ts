'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { erc20Abi, isAddressEqual, type Address } from 'viem'
import { toCallPolicy, toSignatureCallerPolicy, CallPolicyVersion, ParamCondition } from '@zerodev/permissions/policies'
import { RTF_SCOPE_RETIRED_REASON } from '@/constants/rain.consts'
import { peanutPublicClient } from '@/app/actions/clients'
import { useAuth } from '@/context/authContext'
import { useKernelClient } from '@/context/kernelClient.context'
import { useZeroDev } from '@/hooks/useZeroDev'
import { RAIN_CARD_FUNDING_QUERY_KEY } from '@/hooks/useCardStopConfirmation'
import { signKernelPermission, PermissionWalletMismatchError } from '@/hooks/wallet/signKernelPermission'
import {
    CollateralReturnError,
    type CollateralReturnFailure,
    type CollateralReturnOutcome,
} from '@/hooks/wallet/cardCollateralReturn'
import { useCardCollateralReturn } from '@/hooks/wallet/useCardCollateralReturn'
import { wireErrorCode } from '@/services/api-error'
import { rainApi, type RainCardFunding } from '@/services/rain'
import type { NoncePublicClient } from '@/utils/kernelNonceRepair.utils'
import { KernelSigningBusyError } from '@/utils/kernelSigningGuard'
import {
    parseLegacyMigration,
    retireLegacyGrants,
    type ParsedLegacyMigration,
} from '@/utils/legacyGrantMigration.utils'
import {
    classifyFundingApiError,
    isFundingWithdrawalInFlight,
    isRainFundingConfigValid,
    isRainFundingWallet,
    isUserCancellation,
    needsFundingGrant,
    type RainFundingConsent,
    type RainFundingError,
    type RainFundingResult,
} from '@/utils/rain-funding.utils'

/** Poll the backend while a grant it accepted is not confirmed on chain yet. */
const PENDING_POLL_INTERVAL_MS = 3_000
const PENDING_POLL_WINDOW_MS = 60_000

type GrantStep = 'idle' | 'returning-balance' | 'updating-permission' | 'signing' | 'submitting'

/** Why moving the card balance stopped a setup attempt, as the setup reports it. */
const RETURN_FAILURES: Record<CollateralReturnFailure, RainFundingError> = {
    'balance-unavailable': { kind: 'balance-unavailable' },
    pending: { kind: 'return-pending' },
    cooldown: { kind: 'return-wait' },
    cancelled: { kind: 'user-cancelled' },
    'account-changed': { kind: 'account-changed' },
    busy: { kind: 'busy' },
    failed: { kind: 'return-failed' },
}

/**
 * Managed card funding: the one scoped permission that lets Peanut's backend
 * keep a finite allowance for the card provider's operator on the user's
 * wallet.
 *
 * `grant` signs that permission with the user's passkey and hands it to the
 * backend, which enables it and sets the first allowance. This hook never sends
 * an approve UserOp itself and never signs an unlimited approval. The
 * permission is approve-only: exact token, exact operator, and an amount
 * ceiling that is part of what the user signs. It is distinct from the
 * withdrawal grant (`useGrantSessionKey`); both can exist on one kernel.
 *
 * Readiness is only ever the backend's own statement (`management.status ===
 * 'ready'`, confirmed from chain state). An allowance, an accepted POST or a
 * signed blob prove nothing here. Consent is a hard gate: without the ticked
 * authorization and the exact statement the backend records, nothing is signed.
 *
 * Fail closed throughout: a funding read that fails is "unknown", never "not
 * granted", so no prompt follows from it. Chain, token, operator, signer and
 * ceiling come from `GET /rain/cards/funding`; this hook holds no addresses of
 * its own. The query is keyed by user so one account's state can never answer
 * for another, and a grant already in flight stops (nothing is sent) if the
 * account or wallet changes under it.
 *
 * A legacy user (`migration_required`) confirms twice: once to retire the old
 * combined grant on chain, once for the new permission. Only the root key can
 * do the first.
 *
 * Card balance the provider can release goes back to the same wallet first,
 * before any old permission is retired (it may be the one that submits it).
 * That adds passkey confirmations. Any outcome other than done or nothing to
 * move stops the attempt there: nothing is retired and nothing is granted. An
 * unknown earlier return blocks the same way until its status is known. After
 * a return the funding state is read again, so retirement never uses a batch
 * read before it, and a backend withdrawal still confirming
 * (`withdrawal_in_flight`) makes setup wait.
 */
export const useRainFunding = ({ enabled = true }: { enabled?: boolean } = {}) => {
    const queryClient = useQueryClient()
    const { user } = useAuth()
    const userId = user?.user?.userId
    const { ensureClientForChain, getPatchedSudoValidator, rebuildClientForChain } = useKernelClient()
    const { handleSendUserOpEncoded, address: connectedAddress } = useZeroDev()
    const { returnCollateral } = useCardCollateralReturn()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [step, setStep] = useState<GrantStep>('idle')
    const [lastError, setLastError] = useState<RainFundingError | null>(null)
    // One grant at a time: a second tap joins the first.
    const inFlightRef = useRef<Promise<RainFundingResult> | null>(null)
    // Latest identity, read after every await of a grant so a switch of
    // account or wallet stops it before anything is sent.
    const identityRef = useRef({ userId, connectedAddress })
    identityRef.current = { userId, connectedAddress }
    const pendingSinceRef = useRef<number | null>(null)

    const {
        data: funding,
        isLoading,
        error: fundingError,
        refetch,
    } = useQuery<RainCardFunding>({
        queryKey: [RAIN_CARD_FUNDING_QUERY_KEY, userId],
        queryFn: () => rainApi.getCardFunding(),
        enabled: enabled && !!userId,
        staleTime: 30_000,
        // A wallet mismatch (409) never heals on retry, and callers offer an
        // explicit retry for everything else.
        retry: false,
        // Bounded: after the window the caller offers Check status instead.
        refetchInterval: (query) => {
            const data = query.state.data
            if (data?.management.status !== 'pending' && !(data && isFundingWithdrawalInFlight(data))) {
                pendingSinceRef.current = null
                return false
            }
            pendingSinceRef.current ??= Date.now()
            return Date.now() - pendingSinceRef.current < PENDING_POLL_WINDOW_MS ? PENDING_POLL_INTERVAL_MS : false
        },
    })

    useEffect(() => {
        setLastError(null)
        setStep('idle')
    }, [userId, connectedAddress])

    const grant = useCallback(
        (consent: RainFundingConsent): Promise<RainFundingResult> => {
            if (inFlightRef.current) return inFlightRef.current

            const startedFor = identityRef.current
            const changed = () =>
                identityRef.current.userId !== startedFor.userId ||
                identityRef.current.connectedAddress !== startedFor.connectedAddress
            const queryKey = [RAIN_CARD_FUNDING_QUERY_KEY, startedFor.userId]

            const run = async (): Promise<RainFundingResult> => {
                setIsSubmitting(true)
                setLastError(null)
                const fail = (error: RainFundingError): RainFundingResult => {
                    setLastError(error)
                    return { ok: false, error }
                }
                try {
                    if (!consent.authorizationAccepted) {
                        return fail({ kind: 'consent-required' })
                    }

                    // Always a fresh read: a cached state must not skip a grant
                    // or repeat one, and this is what makes a retry idempotent.
                    let live: RainCardFunding
                    try {
                        live = await rainApi.getCardFunding()
                    } catch (e) {
                        const error = classifyFundingApiError(e)
                        return fail(
                            error.kind === 'unexpected'
                                ? { kind: 'funding-unavailable', message: error.message }
                                : error
                        )
                    }
                    if (changed()) return fail({ kind: 'account-changed' })

                    // Checks a fresh funding read. A result means there is
                    // nothing to sign now; null means sign against it.
                    const nothingToSign = (read: RainCardFunding): RainFundingResult | null => {
                        if (!isRainFundingConfigValid(read)) return fail({ kind: 'config-mismatch' })
                        // The statement the user ticked must be the statement
                        // the backend will record.
                        if (consent.authorizationText !== read.permission.authorizationText) {
                            // Show the person the text now on record before asking again.
                            queryClient.setQueryData<RainCardFunding>(queryKey, read)
                            return fail({ kind: 'terms-changed' })
                        }
                        // A retired permission never reinstalls: no prompt, no
                        // signature. Internal support restores it with a new one.
                        if (read.management.reason === RTF_SCOPE_RETIRED_REASON) {
                            queryClient.setQueryData<RainCardFunding>(queryKey, read)
                            return fail({ kind: 'scope-retired' })
                        }
                        // A card withdrawal is still confirming: setup waits,
                        // and nothing is retired or signed until it settles.
                        if (isFundingWithdrawalInFlight(read)) {
                            queryClient.setQueryData<RainCardFunding>(queryKey, read)
                            return fail({ kind: 'withdrawal-in-flight' })
                        }
                        if (!needsFundingGrant(read.management.status)) {
                            // ready / pending / temporarily_unavailable: nothing
                            // to sign. Cache what the backend says and let the
                            // caller wait or move on.
                            queryClient.setQueryData<RainCardFunding>(queryKey, read)
                            return { ok: true, status: read.management.status }
                        }
                        return null
                    }
                    const settledEarly = nothingToSign(live)
                    if (settledEarly) return settledEarly
                    const { status } = live.management

                    const kernelClient = await ensureClientForChain(live.chainId)
                    if (changed()) return fail({ kind: 'account-changed' })
                    if (!isRainFundingWallet(live, kernelClient.account?.address)) {
                        return fail({ kind: 'wallet-mismatch' })
                    }
                    const walletAddress = live.walletAddress as Address

                    // The backend names the old validations. A payload this app
                    // cannot check is never acted on, and nothing is prompted.
                    let migration: ParsedLegacyMigration | null = null
                    if (status === 'migration_required') {
                        try {
                            migration = parseLegacyMigration(live.management.migration)
                        } catch {
                            return fail({ kind: 'config-mismatch' })
                        }
                    }

                    // Card balance back to this wallet before anything is
                    // retired. It reconciles an earlier unsettled return first.
                    let returned: CollateralReturnOutcome
                    try {
                        returned = await returnCollateral({ onStart: () => setStep('returning-balance') })
                    } catch (e) {
                        const kind = e instanceof CollateralReturnError ? e.kind : 'failed'
                        return fail(RETURN_FAILURES[kind])
                    }
                    if (changed()) return fail({ kind: 'account-changed' })
                    // The return may have migrated or rebuilt the client: check
                    // the current one is still the funded wallet.
                    const currentClient = await ensureClientForChain(live.chainId)
                    if (changed()) return fail({ kind: 'account-changed' })
                    if (!isRainFundingWallet(live, currentClient.account?.address)) {
                        return fail({ kind: 'wallet-mismatch' })
                    }

                    // A return can take a while: the state and the batch read
                    // before it are stale. Act only on a fresh read.
                    let current = live
                    if (returned.kind === 'returned') {
                        try {
                            current = await rainApi.getCardFunding()
                        } catch (e) {
                            return fail({ kind: 'funding-unavailable', message: (e as Error).message })
                        }
                        if (changed()) return fail({ kind: 'account-changed' })
                        if (!isRainFundingWallet(current, walletAddress)) return fail({ kind: 'wallet-mismatch' })
                        const settledAfterReturn = nothingToSign(current)
                        if (settledAfterReturn) return settledAfterReturn
                        migration = null
                        if (current.management.status === 'migration_required') {
                            try {
                                migration = parseLegacyMigration(current.management.migration)
                            } catch {
                                return fail({ kind: 'config-mismatch' })
                            }
                        }
                    }

                    let toSign = current
                    if (migration) {
                        setStep('updating-permission')
                        try {
                            // Confirmation 1: one root (passkey) userOp that
                            // uninstalls each old validation, then raises the
                            // nonce floor. Only the root key can do either.
                            await retireLegacyGrants({
                                publicClient: peanutPublicClient as unknown as NoncePublicClient,
                                accountAddress: walletAddress,
                                migration,
                                sendUserOp: (calls) => handleSendUserOpEncoded(calls, current.chainId),
                            })
                        } catch (e) {
                            if (e instanceof KernelSigningBusyError) return fail({ kind: 'busy' })
                            if (isUserCancellation(e)) return fail({ kind: 'user-cancelled' })
                            if ((e as Error).name === 'KernelNonceRepairPendingError') {
                                return fail({ kind: 'migration-pending' })
                            }
                            return fail({ kind: 'unexpected', message: (e as Error).message ?? String(e) })
                        }
                        if (changed()) return fail({ kind: 'account-changed' })

                        // Sign only against backend-confirmed chain state: the
                        // legacy grant must read as retired (status no longer
                        // `migration_required`) before a fresh permission is
                        // signed at the new epoch.
                        try {
                            toSign = await rainApi.getCardFunding()
                        } catch (e) {
                            return fail({ kind: 'funding-unavailable', message: (e as Error).message })
                        }
                        if (changed()) return fail({ kind: 'account-changed' })
                        if (
                            toSign.management.status === 'migration_required' ||
                            !isRainFundingConfigValid(toSign) ||
                            !isAddressEqual(toSign.walletAddress as Address, walletAddress) ||
                            consent.authorizationText !== toSign.permission.authorizationText
                        ) {
                            return fail({ kind: 'migration-pending' })
                        }
                        if (toSign.management.reason === RTF_SCOPE_RETIRED_REASON) {
                            queryClient.setQueryData<RainCardFunding>(queryKey, toSign)
                            return fail({ kind: 'scope-retired' })
                        }
                        if (!needsFundingGrant(toSign.management.status)) {
                            queryClient.setQueryData<RainCardFunding>(queryKey, toSign)
                            return { ok: true, status: toSign.management.status }
                        }
                    }

                    // Exactly two policies, in this order, and nothing else.
                    // 1. approve on the exact token, spender pinned to the exact
                    //    operator, amount capped at the ceiling, zero ETH.
                    // 2. a signature-caller policy with NO allowed callers
                    //    (default flag: for all validation), which denies every
                    //    ERC-1271 signature. The validator-level
                    //    NOT_FOR_VALIDATE_SIG flag is not used: serialization
                    //    drops it.
                    const callPolicy = await toCallPolicy({
                        policyVersion: CallPolicyVersion.V0_0_4,
                        permissions: [
                            {
                                target: toSign.tokenAddress as Address,
                                abi: erc20Abi,
                                functionName: 'approve',
                                valueLimit: 0n,
                                args: [
                                    { condition: ParamCondition.EQUAL, value: toSign.operatorAddress as Address },
                                    {
                                        condition: ParamCondition.LESS_THAN_OR_EQUAL,
                                        value: BigInt(toSign.permission.ceiling),
                                    },
                                ],
                            },
                        ],
                    })
                    const noSignaturesPolicy = await toSignatureCallerPolicy({ allowedCallers: [] })

                    setStep('signing')
                    // Signed right before the POST: the enable signature binds to
                    // the kernel's live nonce.
                    const serializedPermission = await signKernelPermission({
                        policies: [callPolicy, noSignaturesPolicy],
                        sessionKeyAddress: toSign.sessionKeyAddress as Address,
                        expectedAccount: walletAddress,
                        kernel: { ensureClientForChain, getPatchedSudoValidator, rebuildClientForChain },
                        sendUserOp: handleSendUserOpEncoded,
                    })
                    if (changed()) return fail({ kind: 'account-changed' })

                    setStep('submitting')
                    let accepted: RainCardFunding
                    try {
                        accepted = await rainApi.submitFundingGrant({
                            serializedPermission,
                            consent: {
                                termsVersion: toSign.permission.termsVersion,
                                authorizationAccepted: true,
                                authorizationText: toSign.permission.authorizationText,
                            },
                        })
                    } catch (e) {
                        // A grant already in flight is not a failure: the
                        // caller waits on the status the backend reports.
                        if (wireErrorCode(e)?.toLowerCase() === 'grant_in_progress') {
                            await queryClient.invalidateQueries({ queryKey })
                            return { ok: true, status: 'pending' }
                        }
                        const error = classifyFundingApiError(e)
                        // Retired or paused: the backend now answers
                        // `temporarily_unavailable`. Re-read so the prompt goes
                        // away for good; there is no retry from here.
                        if (error.kind === 'scope-retired' || error.kind === 'unavailable') {
                            await queryClient.invalidateQueries({ queryKey })
                        }
                        return fail(error)
                    }
                    if (changed()) return fail({ kind: 'account-changed' })
                    queryClient.setQueryData<RainCardFunding>(queryKey, accepted)
                    // Accepted is not granted: only a state the backend
                    // confirmed from chain counts. Anything still asking for a
                    // grant means the backend did not take this one.
                    if (needsFundingGrant(accepted.management.status)) return fail({ kind: 'rejected' })
                    return { ok: true, status: accepted.management.status }
                } catch (err) {
                    if (err instanceof PermissionWalletMismatchError) return fail({ kind: 'wallet-mismatch' })
                    if (err instanceof KernelSigningBusyError) return fail({ kind: 'busy' })
                    if (isUserCancellation(err)) return fail({ kind: 'user-cancelled' })
                    return fail({ kind: 'unexpected', message: (err as Error).message ?? String(err) })
                } finally {
                    setIsSubmitting(false)
                    setStep('idle')
                }
            }

            const promise = run().finally(() => {
                inFlightRef.current = null
            })
            inFlightRef.current = promise
            return promise
        },
        [
            queryClient,
            ensureClientForChain,
            getPatchedSudoValidator,
            rebuildClientForChain,
            handleSendUserOpEncoded,
            returnCollateral,
        ]
    )

    /** Re-read the state and drop the last error — the way out of `pending`. */
    const recheck = useCallback(async () => {
        setLastError(null)
        pendingSinceRef.current = null
        await refetch()
    }, [refetch])

    const status = funding?.management.status

    return {
        funding,
        /** `undefined` while the state is unknown — never read that as "not granted". */
        status,
        needsGrant: status === undefined ? undefined : needsFundingGrant(status, funding?.management.reason),
        isMigration: status === 'migration_required',
        isPending: status === 'pending',
        /** A card withdrawal is still confirming: setup is unfinished and waits for it. */
        isWithdrawalInFlight: !!funding && isFundingWithdrawalInFlight(funding),
        isLoading,
        fundingError,
        grant,
        recheck,
        isSubmitting,
        /** Which confirmation the user is on while a grant runs. */
        step,
        lastError,
    }
}
