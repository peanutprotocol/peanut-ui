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
import { fundingAccessQueryKey } from '@/hooks/useCardFundingAccess'
import { signKernelPermission, PermissionWalletMismatchError } from '@/hooks/wallet/signKernelPermission'
import {
    CollateralReturnError,
    collateralReturnOwner,
    pendingCollateralReturns,
    type CollateralReturnFailure,
} from '@/hooks/wallet/cardCollateralReturn'
import { useCardCollateralReturn } from '@/hooks/wallet/useCardCollateralReturn'
import { wireErrorCode } from '@/services/api-error'
import { rainApi, type RainCardFunding, type RainFundingAccess } from '@/services/rain'
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
    sameIdentity,
    type CardFlowIdentity,
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

const returnFailure = (e: unknown): RainFundingError =>
    RETURN_FAILURES[e instanceof CollateralReturnError ? e.kind : 'failed']

/** A card-balance return a setup still owes: for which user and wallet, and why its last try stopped. */
interface OwedReturn {
    owner: string
    error: RainFundingError | null
}

const identityKey = (userId: string | undefined, wallet: string | undefined) =>
    userId && wallet ? `${userId}:${wallet.toLowerCase()}` : null

/**
 * Managed card funding: the one scoped permission that lets Peanut's backend
 * keep a finite allowance for the user's Rain collateral proxy on the user's
 * wallet.
 *
 * `grant` signs that permission with the user's passkey and hands it to the
 * backend, which enables it and sets the first allowance. This hook never sends
 * an approve UserOp itself and never signs an unlimited approval. The
 * permission is approve-only: exact token, exact spender, and an amount
 * ceiling that is part of what the user signs. It is distinct from the
 * withdrawal grant (`useGrantSessionKey`); both can exist on one kernel.
 *
 * Readiness is only ever the backend's own statement (`management.status ===
 * 'ready'`, confirmed from chain state). An allowance, an accepted POST or a
 * signed blob prove nothing here. Consent is a hard gate: without the ticked
 * authorization and the exact statement the backend records, nothing is signed.
 *
 * Fail closed throughout: a funding read that fails is "unknown", never "not
 * granted", so no prompt follows from it. Chain, token, spender, signer and
 * ceiling come from `GET /rain/cards/funding`; this hook holds no addresses of
 * its own. The query is keyed by user so one account's state can never answer
 * for another, and a grant already in flight stops (nothing is sent) if the
 * account or wallet changes under it.
 *
 * A legacy user (`migration_required`) confirms twice: once to retire the old
 * combined grant on chain, once for the new permission. Only the root key can
 * do the first.
 *
 * Order of a setup: settle any earlier card-balance return whose outcome is
 * unknown (nothing new is sent; still unknown stops here), read the state
 * fresh, retire the old grant if needed, sign and post the new permission, and
 * only once the backend reports it `ready` move the card balance the provider
 * can release back to the same wallet. Until then the card balance stays on the
 * card: a cancel, a refusal, a pending or unavailable state never moves it.
 * After a retirement the stored withdrawal permission cannot submit any more,
 * so this wallet's returns go through the wallet itself (root path).
 *
 * A post answered `pending` ends the attempt. The return it still owes is
 * remembered in memory for this user and wallet only (a reload or a switch
 * forgets it; the card screen still offers the move) and runs on the explicit
 * `continueSetup`, never from a render. A return that fails after `ready`
 * keeps funding as it is and is retried the same way, never by granting again.
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
    // The card-balance return a setup started here still owes, and why its last
    // try did not finish. Memory only, for one user and wallet.
    const [owedReturn, setOwedReturnState] = useState<OwedReturn | null>(null)
    const owedReturnRef = useRef<OwedReturn | null>(null)
    const setOwedReturn = useCallback((next: OwedReturn | null) => {
        owedReturnRef.current = next
        setOwedReturnState(next)
    }, [])

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
        setOwedReturn(null)
    }, [userId, connectedAddress, setOwedReturn])

    /**
     * The only place a setup moves card balance: after a fresh read in which the
     * backend reports the new permission `ready` for this same wallet. Anything
     * else leaves the balance on the card. A failed return keeps funding as it
     * is and stays owed, for an explicit retry.
     */
    const returnWhenReady = useCallback(
        async (owner: string, changed: () => boolean, queryKey: unknown[]): Promise<RainFundingResult> => {
            const accountChanged: RainFundingResult = { ok: false, error: { kind: 'account-changed' } }
            const stop = (error: RainFundingError): RainFundingResult => {
                if (!changed()) setOwedReturn({ owner, error })
                return { ok: false, error }
            }
            let read: RainCardFunding
            try {
                read = await rainApi.getCardFunding()
            } catch (e) {
                return stop({ kind: 'funding-unavailable', message: (e as Error).message })
            }
            if (changed()) return accountChanged
            queryClient.setQueryData<RainCardFunding>(queryKey, read)
            if (read.management.status !== 'ready') return { ok: true, status: read.management.status }
            if (!isRainFundingConfigValid(read)) return stop({ kind: 'config-mismatch' })
            try {
                const client = await ensureClientForChain(read.chainId)
                if (changed()) return accountChanged
                if (!isRainFundingWallet(read, client.account?.address)) return stop({ kind: 'wallet-mismatch' })
            } catch (e) {
                return stop({ kind: 'unexpected', message: (e as Error).message ?? String(e) })
            }

            setOwedReturn({ owner, error: null })
            try {
                await returnCollateral({ onStart: () => setStep('returning-balance') })
            } catch (e) {
                const error = returnFailure(e)
                if (changed()) return accountChanged
                setOwedReturn({ owner, error })
                return { ok: true, status: 'ready', returnError: error }
            }
            if (changed()) return accountChanged
            setOwedReturn(null)
            return { ok: true, status: 'ready' }
        },
        [queryClient, ensureClientForChain, returnCollateral, setOwedReturn]
    )

    const grant = useCallback(
        (consent: RainFundingConsent, expected?: CardFlowIdentity): Promise<RainFundingResult> => {
            // Consent handed over from another flow belongs to the account and
            // wallet it was given for; for any other it starts nothing.
            if (expected && !sameIdentity(identityRef.current, expected)) {
                return Promise.resolve({ ok: false, error: { kind: 'account-changed' } })
            }
            if (inFlightRef.current) return inFlightRef.current

            const startedFor = identityRef.current
            const changed = () => !sameIdentity(identityRef.current, startedFor)
            const queryKey = [RAIN_CARD_FUNDING_QUERY_KEY, startedFor.userId]
            const accessKey = fundingAccessQueryKey(startedFor)
            const owner = identityKey(startedFor.userId, startedFor.connectedAddress)
            const owe = () => {
                if (owner && !changed()) setOwedReturn({ owner, error: null })
            }

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

                    // An earlier card-balance return whose outcome is unknown
                    // is settled from its own evidence first. Nothing new is
                    // sent here; still unknown stops the setup before anything
                    // is retired or signed.
                    try {
                        await returnCollateral({ reconcileOnly: true })
                    } catch (e) {
                        return fail(returnFailure(e))
                    }
                    if (changed()) return fail({ kind: 'account-changed' })

                    // The server's funding decision, read fresh. Unknown signs
                    // nothing. A managed account goes on whatever the rollout
                    // flag says now; a legacy one has to be admitted first.
                    let access: RainFundingAccess
                    try {
                        access = await rainApi.getFundingAccess()
                    } catch (e) {
                        return fail({ kind: 'funding-unavailable', message: (e as Error).message })
                    }
                    if (changed()) return fail({ kind: 'account-changed' })
                    queryClient.setQueryData(accessKey, access)
                    if (access.fundingMode === 'legacy' && !access.enrollmentAllowed) {
                        return fail({ kind: 'enrollment-not-allowed' })
                    }

                    // Always a fresh read: a cached state must not skip a grant
                    // or repeat one, and this is what makes a retry idempotent.
                    const readFunding = async (): Promise<RainCardFunding | RainFundingResult> => {
                        try {
                            return await rainApi.getCardFunding()
                        } catch (e) {
                            const error = classifyFundingApiError(e)
                            return fail(
                                error.kind === 'unexpected'
                                    ? { kind: 'funding-unavailable', message: error.message }
                                    : error
                            )
                        }
                    }
                    const firstRead = await readFunding()
                    if ('ok' in firstRead) return firstRead
                    let live: RainCardFunding = firstRead
                    if (changed()) return fail({ kind: 'account-changed' })

                    // Accepting comes first, before anything old is retired or
                    // anything new is signed: the backend records the consent
                    // for this wallet, and only then shows what to retire.
                    if (access.fundingMode === 'legacy') {
                        if (!isRainFundingConfigValid(live)) return fail({ kind: 'config-mismatch' })
                        if (consent.authorizationText !== live.permission.authorizationText) {
                            queryClient.setQueryData<RainCardFunding>(queryKey, live)
                            return fail({ kind: 'terms-changed' })
                        }
                        let enrolled: RainFundingAccess
                        try {
                            enrolled = await rainApi.enrollFunding({
                                consent: {
                                    termsVersion: live.permission.termsVersion,
                                    authorizationAccepted: true,
                                    authorizationText: live.permission.authorizationText,
                                },
                            })
                        } catch (e) {
                            await queryClient.invalidateQueries({ queryKey: accessKey })
                            return fail(classifyFundingApiError(e))
                        }
                        if (changed()) return fail({ kind: 'account-changed' })
                        queryClient.setQueryData(accessKey, enrolled)
                        if (enrolled.fundingMode !== 'managed') return fail({ kind: 'enrollment-not-allowed' })
                        const admittedRead = await readFunding()
                        if ('ok' in admittedRead) return admittedRead
                        live = admittedRead
                        if (changed()) return fail({ kind: 'account-changed' })
                    }

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

                    let toSign = live
                    if (migration) {
                        setStep('updating-permission')
                        // Retired old validations and a raised nonce floor leave
                        // the stored withdrawal permission unable to submit, so
                        // this wallet's card balance returns go through the
                        // wallet itself. Recorded before the attempt: a
                        // retirement can land while its answer is lost, and the
                        // next state then no longer says migration. A cancelled
                        // attempt only costs a later return one more confirmation.
                        pendingCollateralReturns.markRootOnly(collateralReturnOwner(startedFor.userId!, walletAddress))
                        try {
                            // Confirmation 1: one root (passkey) userOp that
                            // uninstalls each old validation, then raises the
                            // nonce floor. Only the root key can do either.
                            await retireLegacyGrants({
                                publicClient: peanutPublicClient as unknown as NoncePublicClient,
                                accountAddress: walletAddress,
                                migration,
                                // Checked again right before the root passkey: the
                                // helper reads chain state first, and the user or
                                // wallet can change meanwhile.
                                sendUserOp: (calls) => {
                                    if (changed()) throw new PermissionWalletMismatchError()
                                    return handleSendUserOpEncoded(calls, live.chainId)
                                },
                            })
                        } catch (e) {
                            if (changed()) return fail({ kind: 'account-changed' })
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
                    //    spender, amount capped at the ceiling, zero ETH.
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
                                    { condition: ParamCondition.EQUAL, value: toSign.spenderAddress as Address },
                                    {
                                        condition: ParamCondition.LESS_THAN_OR_EQUAL,
                                        value: BigInt(toSign.permission.ceiling),
                                    },
                                ],
                            },
                        ],
                    })
                    const noSignaturesPolicy = await toSignatureCallerPolicy({ allowedCallers: [] })
                    if (changed()) return fail({ kind: 'account-changed' })

                    setStep('signing')
                    // Signed right before the POST: the enable signature binds to
                    // the kernel's live nonce.
                    const serializedPermission = await signKernelPermission({
                        policies: [callPolicy, noSignaturesPolicy],
                        sessionKeyAddress: toSign.sessionKeyAddress as Address,
                        expectedAccount: walletAddress,
                        isCurrent: () => !changed(),
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
                            owe()
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
                    // From here this setup owes the card-balance return, and
                    // only a confirmed `ready` lets it run.
                    owe()
                    if (accepted.management.status !== 'ready' || !owner) {
                        return { ok: true, status: accepted.management.status }
                    }
                    return await returnWhenReady(owner, changed, queryKey)
                } catch (err) {
                    if (err instanceof PermissionWalletMismatchError) {
                        return fail(changed() ? { kind: 'account-changed' } : { kind: 'wallet-mismatch' })
                    }
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
            returnWhenReady,
            setOwedReturn,
        ]
    )

    /**
     * Finishes a setup that still owes the card-balance return: once the backend
     * reports `ready`, or again after a return that did not finish. Explicit
     * only. It never grants funding permission again; the return still needs confirmation.
     */
    const continueSetup = useCallback((): Promise<RainFundingResult> => {
        if (inFlightRef.current) return inFlightRef.current
        const startedFor = identityRef.current
        const owner = identityKey(startedFor.userId, startedFor.connectedAddress)
        if (!owner || owedReturnRef.current?.owner !== owner) {
            return Promise.resolve({ ok: false, error: { kind: 'unexpected', message: 'No setup to continue' } })
        }
        const changed = () =>
            identityRef.current.userId !== startedFor.userId ||
            identityRef.current.connectedAddress !== startedFor.connectedAddress
        const run = async (): Promise<RainFundingResult> => {
            setIsSubmitting(true)
            try {
                return await returnWhenReady(owner, changed, [RAIN_CARD_FUNDING_QUERY_KEY, startedFor.userId])
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
    }, [returnWhenReady])

    /** Re-read the state and drop the last error — the way out of `pending`. */
    const recheck = useCallback(async () => {
        setLastError(null)
        pendingSinceRef.current = null
        await refetch()
    }, [refetch])

    const status = funding?.management.status
    const owes = !!owedReturn && owedReturn.owner === identityKey(userId, connectedAddress)

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
        /** This session's setup still owes moving the card balance back (runs only once funding is ready). */
        owesReturn: owes,
        /** Why the owed return's last try did not finish; null before any try. */
        returnError: owes && owedReturn ? owedReturn.error : null,
        continueSetup,
    }
}
