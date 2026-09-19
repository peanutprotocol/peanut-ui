'use client'

import { useAuth } from '@/context/authContext'
import { useCapabilities } from '@/hooks/useCapabilities'
import { API_ERROR_CODES, apiErrorStatus, wireErrorCode } from '@/services/api-error'
import { claimDepositAccount, fetchDepositAccounts } from '@/services/deposit-accounts'
import type { GateState } from '@/utils/capability-gate'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    trackClaimed,
    trackClaimFailed,
    trackClaimStarted,
    trackEndorsementApproved,
    trackEndorsementRequested,
} from './analytics'
import {
    corridorFromRailId,
    corridorsFromRails,
    DEPOSIT_RAIL_ORDER,
    emptyCorridorRecord,
    DEPOSIT_RAILS,
    isClaimable,
    railIdFor,
} from './rails'
import { holdsSlot } from './resolveScreen'
import type {
    ClaimableCorridor,
    UnavailableCorridor,
    DepositAccount,
    DepositAccountView,
    DepositCorridor,
} from './types'

export const DEPOSIT_ACCOUNTS_QUERY_KEY = ['deposit-accounts'] as const

/**
 * How often the preview is re-read while the provider reviews a corridor.
 *
 * The review takes a few minutes and the user is on a screen watching it, so
 * the answer has to arrive without them doing anything. Slower than the
 * provisioning poll because nothing is being minted — this is somebody else's
 * queue moving, not our own work finishing.
 */
export const ENDORSEMENT_POLL_MS = 15_000

/** how long a provisioning account is given before the screen stops waiting */
export const PROVISIONING_POLL_MS = 5_000
export const MAX_PROVISIONING_POLLS = 24

/** the corridor a claim failed on, so a stale error cannot be shown on another */
export interface DepositClaimError {
    corridor: DepositCorridor
    /** the backend's own English sentence — for Sentry and the analytics event, never for a screen */
    message: string
    /** the wire discriminant the screen picks its localized sentence from */
    code?: string
    /** the residence refusal carries no code, only a 403 */
    status?: number
    /**
     * The backend refused to open an account for this user at all — the
     * server-side rollout gate on the claim route, a missing provider customer,
     * an unserved rail. It is not a failure the user can retry their way out
     * of, so the screen says "not available to you yet" in the gate's own words
     * rather than showing a backend sentence written for us.
     */
    unavailable: boolean
}

export interface UseDepositAccountsResult {
    /** the corridors this user has a rail for, in catalogue order */
    corridors: DepositCorridor[]
    accounts: Record<DepositCorridor, DepositAccountView | undefined>
    /**
     * The terms a corridor WOULD carry if the user opened it, by corridor.
     * Only corridors the user can open are here — one they already hold is in
     * `accounts`, with its confirmed terms — so a corridor with no entry is
     * one the claim step can say nothing about.
     */
    claimable: Record<DepositCorridor, ClaimableCorridor | undefined>
    /**
     * Why a corridor is withheld, where the backend says so. A corridor with no
     * entry here and none in `claimable` or `accounts` is one it would not
     * guess about, and the rows keep their gate-derived answer.
     */
    unavailable: Record<DepositCorridor, UnavailableCorridor | undefined>
    /**
     * How many account slots the user has taken, counted the way the backend's
     * cap counts them. Every returned account counts, not one per corridor: a
     * rotation holds the new account and the retiring one at once. The
     * backend's own count where it sends one.
     */
    slotsHeld: number
    /** this user's account limit, which support can raise; undefined on an API that does not send it */
    accountLimit?: number
    /** the capability gate for EACH corridor, asked one rail id at a time */
    gates: Record<DepositCorridor, GateState>
    /** true until both the corridors and the held accounts are known */
    isLoading: boolean
    /** the accounts could not be read — distinct from "you hold none" */
    isError: boolean
    claimingCorridor?: DepositCorridor
    claimError?: DepositClaimError
    claim: (corridor: DepositCorridor) => void
    refetch: () => void
}

/**
 * Everything the get-paid flow needs, from the places that own it: which
 * corridors exist for this user and whether they may deposit on each from the
 * capability block, and the accounts they hold from the backend.
 *
 * A provisioning account refetches on a short interval — the provider usually
 * takes under a minute, and the alternative is a user staring at a skeleton
 * that never resolves until they navigate away and back. The interval is
 * capped: past two minutes the provider is not coming back on its own, and an
 * uncapped 5s poll on a phone left open is a battery bill with no answer at
 * the end of it. The corridor reads as timed out then, which is the one state
 * with a retry on it.
 */
export function useDepositAccounts({ enabled = true }: { enabled?: boolean } = {}): UseDepositAccountsResult {
    const { userId } = useAuth()
    const queryClient = useQueryClient()
    const { gateFor, rails, isLoading: capabilitiesLoading } = useCapabilities()
    const [claimingCorridor, setClaimingCorridor] = useState<DepositCorridor | undefined>()
    const [claimError, setClaimError] = useState<DepositClaimError | undefined>()

    // answers that still said "provisioning", counted per account since the last
    // one that did not — each account's own budget, and what ends its wait. One
    // shared counter made the budgets contagious: an account that started
    // waiting late inherited whatever an older one had already spent, and
    // claiming a second corridor handed the first one a fresh wait it had not
    // earned.
    const [provisioningPolls, setProvisioningPolls] = useState<Record<string, number>>({})

    const query = useQuery({
        queryKey: [...DEPOSIT_ACCOUNTS_QUERY_KEY, userId],
        enabled: !!userId && enabled,
        queryFn: fetchDepositAccounts,
        refetchInterval: (q) => {
            if (hasAccountStillWaiting(q.state.data?.accounts, provisioningPolls)) return PROVISIONING_POLL_MS
            // A corridor whose review is under way resolves on its own, and the
            // screen is waiting on exactly this read to continue into the claim.
            return (q.state.data?.claimable ?? []).some((corridor) => corridor.blockedBy === 'endorsement-pending')
                ? ENDORSEMENT_POLL_MS
                : false
        },
    })

    const { dataUpdatedAt } = query
    useEffect(() => {
        if (!dataUpdatedAt) return
        setProvisioningPolls((polls) => {
            const next: Record<string, number> = {}
            for (const account of query.data?.accounts ?? []) {
                // an account that stopped provisioning keeps no count, so a
                // later wait on it starts from its own zero
                if (account.status === 'provisioning') next[account.id] = (polls[account.id] ?? 0) + 1
            }
            return next
        })
        // one bump per answer from the server, not per render
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataUpdatedAt])

    const claim = useMutation({
        mutationFn: claimDepositAccount,
        onMutate: (method: string) => {
            const corridor = method as DepositCorridor
            // a fresh attempt owns the error slot: the previous corridor's
            // failure must not sit on this screen while this one is in flight
            setClaimError(undefined)
            setClaimingCorridor(corridor)
            // An idempotent retry keeps the account id, so reset only this corridor's budget.
            setProvisioningPolls((polls) => {
                const next = { ...polls }
                for (const account of query.data?.accounts ?? []) {
                    if (corridorFromRailId(account.railId) === corridor) delete next[account.id]
                }
                return next
            })
            trackClaimStarted(corridor)
        },
        onSuccess: (result, method: string) => {
            const corridor = method as DepositCorridor
            if (result.outcome === 'opened') trackClaimed(corridor, DEPOSIT_RAILS[corridor].currency)
            if (result.outcome === 'endorsement_pending') trackEndorsementRequested(corridor)
        },
        onError: (error: Error, method: string) => {
            const corridor = method as DepositCorridor
            setClaimError({
                corridor,
                message: error.message,
                code: wireErrorCode(error),
                status: apiErrorStatus(error),
                unavailable: isNotAvailableYet(error),
            })
            trackClaimFailed(corridor, error.message)
        },
        onSettled: async () => {
            setClaimingCorridor(undefined)
            await queryClient.invalidateQueries({ queryKey: DEPOSIT_ACCOUNTS_QUERY_KEY })
        },
    })

    /**
     * The accounts the user holds, by corridor. A corridor with no account is
     * the normal case: only Bridge corridors are standing accounts, and one
     * that has never been claimed has nothing to return either.
     *
     * One corridor can carry several accounts during a provider rotation: the
     * new one and the retiring predecessor it replaces. `isPrimary` names the
     * details a NEW payer should be given, so it decides — response order must
     * not, or a rotation can put retired details in a payroll form.
     */
    const accounts = useMemo((): Record<DepositCorridor, DepositAccountView | undefined> => {
        const byCorridor = emptyCorridorRecord<DepositAccountView>()
        for (const account of query.data?.accounts ?? []) {
            const corridor = corridorFromRailId(account.railId)
            if (!corridor) continue
            // The wait is over and the provider never answered. The status
            // stays `provisioning`, because that is still what the backend
            // says; `timedOut` is the client's own answer, and the only state
            // the details screen offers a retry on — a skeleton that stopped
            // refreshing offers nothing.
            const resolved =
                account.status === 'provisioning' && (provisioningPolls[account.id] ?? 0) >= MAX_PROVISIONING_POLLS
                    ? { ...account, timedOut: true as const }
                    : account
            byCorridor[corridor] = preferred(byCorridor[corridor], resolved)
        }
        return byCorridor
    }, [query.data, provisioningPolls])

    const slotsHeld = useMemo(
        () => query.data?.accountsHeld ?? (query.data?.accounts ?? []).filter(holdsSlot).length,
        [query.data]
    )

    const claimable = useMemo((): Record<DepositCorridor, ClaimableCorridor | undefined> => {
        const byCorridor = emptyCorridorRecord<ClaimableCorridor>()
        for (const corridorTerms of query.data?.claimable ?? []) {
            const corridor = corridorFromRailId(corridorTerms.railId)
            if (corridor) byCorridor[corridor] = corridorTerms
        }
        return byCorridor
    }, [query.data])

    /**
     * Why a corridor is NOT on offer, straight from the backend. It replaces
     * the app's own guess at the same question: the capability gate answers
     * `needs-identity` for a corridor whose rail it cannot read as well as for
     * a user who has not verified, and the two need opposite screens.
     *
     * A corridor in none of the three lists is one the backend would not guess
     * about — the provider read failed — so it is absent here too and the rows
     * keep the gate's own answer.
     */
    const unavailable = useMemo((): Record<DepositCorridor, UnavailableCorridor | undefined> => {
        const byCorridor = emptyCorridorRecord<UnavailableCorridor>()
        for (const withheld of query.data?.unavailable ?? []) {
            const corridor = corridorFromRailId(withheld.railId)
            if (corridor) byCorridor[corridor] = withheld
        }
        return byCorridor
    }, [query.data])

    /**
     * The rows this user gets: their own rails, plus any corridor they already
     * hold an account on, plus any the backend says they could open. A rail
     * that leaves the catalogue takes the capability with it and leaves the
     * account standing, and an account a payer may still be sending money to
     * has to stay readable.
     *
     * The third group is the one that is not a rail. A corridor whose gate is a
     * provider review has no rail until the review passes, and the tap on the
     * row is what asks for the review — so waiting for the rail before showing
     * the row is a corridor nobody can ever reach. That is what dropped the
     * Colombian row and sent the country pick to the waitlist.
     *
     * A withheld corridor is the fourth group, and it is here for the same
     * reason: the backend named it, so it gets a row that says it is not
     * available. It may have no rail — being withheld is often why — and the
     * hub no longer keeps a catalogue fallback that would have carried it.
     */
    const corridors = useMemo(
        () =>
            !enabled
                ? []
                : corridorsFromRails(
                      rails,
                      DEPOSIT_RAIL_ORDER.filter(
                          (corridor) => accounts[corridor] || claimable[corridor] || unavailable[corridor]
                      )
                  ).filter(
                      (corridor) =>
                          !query.data ||
                          accounts[corridor] ||
                          !isClaimable(DEPOSIT_RAILS[corridor]) ||
                          gateFor('deposit', { railId: railIdFor(corridor) }).kind !== 'ready' ||
                          claimable[corridor] ||
                          unavailable[corridor]
                  ),
        [enabled, rails, accounts, query.data, gateFor, claimable, unavailable]
    )

    const gates = useMemo((): Record<DepositCorridor, GateState> => {
        const out = {} as Record<DepositCorridor, GateState>
        for (const corridor of DEPOSIT_RAIL_ORDER) {
            // railId, not { channel: 'bank' }: a channel-wide gate answers
            // "ready" as soon as ANY bank rail is enabled, so one working
            // Manteca rail was unlocking four Bridge corridors the user has no
            // rail for at all. A corridor with no rail in the capability block
            // resolves to needs-identity / needs-enrollment, which is the
            // honest answer.
            out[corridor] = gateFor('deposit', { railId: railIdFor(corridor) })
        }
        return out
    }, [gateFor])

    // A review that has come back is worth one event, on the transition alone:
    // the preview repeats the same answer on every poll afterwards.
    const pendingReviews = useRef<Set<DepositCorridor>>(new Set())
    useEffect(() => {
        const waiting = pendingReviews.current
        for (const corridor of DEPOSIT_RAIL_ORDER) {
            const blocked = claimable[corridor]?.blockedBy === 'endorsement-pending'
            if (blocked) waiting.add(corridor)
            // Only a corridor the preview still offers: one that vanished says
            // nothing about the review, and a failed read must not read as news.
            else if (claimable[corridor] && waiting.delete(corridor)) trackEndorsementApproved(corridor)
        }
    }, [claimable])

    const doClaim = useCallback((corridor: DepositCorridor) => claim.mutate(corridor), [claim])

    return {
        corridors,
        accounts,
        claimable,
        unavailable,
        slotsHeld,
        accountLimit: query.data?.accountLimit,
        gates,
        // a flow that is not asking for accounts is never waiting for them
        isLoading: enabled && (!userId || query.isLoading || capabilitiesLoading),
        isError: query.isError,
        claimingCorridor,
        claimError,
        claim: doClaim,
        refetch: () => {
            // an explicit retry is the user saying to wait again, on every
            // account that is still waiting
            setProvisioningPolls({})
            void query.refetch()
        },
    }
}

/** is any account still provisioning AND still inside its own budget? */
/**
 * A refusal to open an account at all, rather than a failed attempt.
 *
 * The claim route carries a server-side rollout gate, and a user outside the
 * rollout is refused there whatever the client-side flag says. It answers 403
 * with `DEPOSIT_ACCOUNTS_NOT_AVAILABLE`; 404 is the same shape of answer from
 * the checks beside it (no provider customer, no rail for this corridor).
 * Neither is worth a retry, and neither should reach a user as the backend's
 * own sentence.
 *
 * The code is read as well as the status, so a 403 the gate did not write —
 * an expired session, say — is not relabelled as "not available to you yet".
 */
function isNotAvailableYet(error: unknown): boolean {
    if (wireErrorCode(error) === API_ERROR_CODES.DEPOSIT_ACCOUNTS_NOT_AVAILABLE) return true
    return apiErrorStatus(error) === 404
}

function hasAccountStillWaiting(accounts: DepositAccount[] | undefined, polls: Record<string, number>): boolean {
    return (accounts ?? []).some(
        (account) => account.status === 'provisioning' && (polls[account.id] ?? 0) < MAX_PROVISIONING_POLLS
    )
}

/**
 * Which of two accounts on one corridor the screens should show.
 *
 * The primary wins outright. With no primary among them — a state the contract
 * allows and the backend should not produce — the one that is not retiring
 * wins, and only then does arrival order decide, so the worst case is
 * arbitrary rather than wrong.
 */
function preferred(current: DepositAccountView | undefined, next: DepositAccountView): DepositAccountView {
    if (!current) return next
    if (next.isPrimary !== current.isPrimary) return next.isPrimary ? next : current
    const retiring = (account: DepositAccountView) => account.status === 'retiring'
    if (retiring(current) !== retiring(next)) return retiring(current) ? next : current
    return current
}
