'use client'

import type { GateState } from '@/utils/capability-gate'
import { parseAsString, useQueryState, useQueryStates } from 'nuqs'
import { useEffect, useRef, useState } from 'react'
import { trackDetailsViewed, trackGateBlocked } from '../analytics'
import { claimErrorKey, claimErrorOffersSupport } from '../claimErrors'
import { DEPOSIT_ACCOUNT_PARAMS, DEPOSIT_CORRIDORS, type DepositAccountScreen } from '../params'
import { DEPOSIT_RAILS, isClaimable } from '../rails'
import { DRAWER_CLOSE_MS } from '../drawer'
import { depositGateView, isDepositBlock } from '../depositGate'
import { isResidenceGated } from '../residenceGate'
import { corridorHasTopUp } from '@/features/add-money/countryRoutes'
import { canShare, isHeld, resolveScreen } from '../resolveScreen'
import type {
    ClaimableCorridor,
    UnavailableCorridor,
    DepositAccountView,
    DepositCorridor,
    DepositSupportReason,
} from '../types'
import type { DepositClaimError } from '../useDepositAccounts'
import type { EndorsementReview } from '../useEndorsementReview'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import NavHeader from '@/components/Global/NavHeader'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { ClaimAccountScreen } from './ClaimAccountScreen'
import { CorridorGateDrawer } from './CorridorGateDrawer'
import { CorridorUnavailableScreen } from './CorridorUnavailableScreen'
import { DepositDetailsSkeleton } from './DepositDetailsSkeleton'
import { DepositAccountDetailsScreen } from './DepositAccountDetailsScreen'
import { DepositAccountsListScreen } from './DepositAccountsListScreen'
import { AccountOpenedScreen } from './AccountOpenedScreen'

export interface DepositAccountsFlowProps {
    /** the corridors this user has a rail for — a deep link to any other lands on the list */
    corridors: DepositCorridor[]
    accounts: Record<DepositCorridor, DepositAccountView | undefined>
    /**
     * The terms each corridor the user does NOT hold would carry, from the
     * backend's own resolver. Optional: an API that predates the preview sends
     * none, and the claim step then states no terms rather than inventing them.
     */
    claimable?: Record<DepositCorridor, ClaimableCorridor | undefined>
    /** why a corridor is withheld, where the backend says so */
    unavailable?: Record<DepositCorridor, UnavailableCorridor | undefined>
    /** account slots taken, counted as the backend's cap counts them — see `holdsSlot` */
    slotsHeld?: number
    /** this user's account limit, where the backend sends it */
    accountLimit?: number
    /** `gateFor('deposit', { railId })` per corridor — the app primitive, one rail at a time */
    gates: Record<DepositCorridor, GateState>
    /** true until the corridors and the held accounts are known */
    isLoading?: boolean
    /** the accounts could not be read; the list says so instead of offering claims */
    isError?: boolean
    /**
     * May a new account be opened? False while the rollout flag is off: the
     * accounts the user already holds stay readable, the claim step and the
     * gate screens behind it do not render.
     */
    claimsEnabled?: boolean
    userName: string
    claimingCorridor?: DepositCorridor
    claimError?: DepositClaimError
    /** leaving the flow entirely — the list is a destination now, not a tab root */
    onExit: () => void
    onClaim: (corridor: DepositCorridor) => void
    /** the corridor rides along: the verification it starts is that corridor's level */
    onResolveGate: (gate: GateState, corridor: DepositCorridor) => void
    onRetry: () => void
    /**
     * The one shared support door, for the things the app cannot settle
     * itself: details the provider revoked, a user who wants more accounts than
     * we open by default, and a provider review the app cannot start. The
     * reason rides along so support does not have to ask which conversation
     * this is.
     */
    onContactSupport: (corridor: DepositCorridor, reason: DepositSupportReason) => void
    /**
     * The other way into a corridor: the bank transfer the user sends
     * themselves. Navigation lives with the caller, as every other way out of
     * this flow does. Absent on a caller that cannot open one.
     */
    onTopUp?: (corridor: DepositCorridor) => void
    /**
     * The provider's hosted page for a corridor review that waits on the user.
     * Absent on a caller that cannot open one: the screen then says what is
     * needed and offers support.
     */
    review?: EndorsementReview
}

/**
 * The bank flow: one NavHeader title across every step, the step in the URL,
 * in-flow back through `onPrev`.
 *
 * Which screen renders is resolved from the SELECTED corridor's gate and its
 * account rather than read off the URL — see `resolveScreen`. The claim step
 * also stays on screen until an account exists, so a provisioning failure has
 * somewhere to be shown instead of dropping the user back on the list with no
 * explanation.
 */
export function DepositAccountsFlow({
    corridors,
    accounts,
    claimable,
    unavailable,
    slotsHeld = 0,
    accountLimit,
    gates,
    isLoading = false,
    isError = false,
    claimsEnabled = true,
    userName,
    claimingCorridor,
    claimError,
    onExit,
    onClaim,
    onResolveGate,
    onRetry,
    onContactSupport,
    onTopUp,
    review,
}: DepositAccountsFlowProps) {
    const [{ step: screen, corridor, screen: legacyStep }, setParams] = useQueryStates(DEPOSIT_ACCOUNT_PARAMS)
    // The typed parser answers its default for a corridor it does not know, so a
    // link naming one that has left the catalogue (`BANK_TRANSFER_BR`) opened
    // the euro account. Read raw, a named corridor that is not one lands on the
    // list instead.
    const [namedCorridor] = useQueryState('corridor', parseAsString)
    const namesUnknownCorridor = namedCorridor !== null && !(DEPOSIT_CORRIDORS as string[]).includes(namedCorridor)
    const [openingCorridor, setOpeningCorridor] = useState<DepositCorridor>()
    // The corridor whose gate the user just started to clear (verification,
    // terms, email). The drawer closes to the list for that flow; once the gate
    // clears, the user goes on to the claim for it without a second tap.
    const [resumeCorridor, setResumeCorridor] = useState<DepositCorridor>()
    const pendingGateAct = useRef<ReturnType<typeof setTimeout>>(undefined)
    useEffect(() => () => clearTimeout(pendingGateAct.current), [])
    // Links minted while the cursor was called `?screen=` still open the flow
    // where they meant to. Rewritten once, in place, so back does not land on
    // the old name.
    useEffect(() => {
        if (legacyStep) setParams({ step: legacyStep, screen: null })
    }, [legacyStep, setParams])
    // Details opened by a link from outside (accounts and payments) never showed
    // the list, so back leaves the flow through onExit and its returnTo. The
    // URL cannot say this: nuqs replaces history, so the step has no past.
    // Read from the requested step, not the resolved one, which is the list
    // for a moment while the accounts load.
    const visitedList = useRef(false)
    useEffect(() => {
        if (screen === 'list' && !legacyStep) visitedList.current = true
    }, [screen, legacyStep])
    const { t, railName, claimErrorBody } = useDepositAccountCopy()
    const rail = DEPOSIT_RAILS[corridor]
    const account = accounts[corridor]
    const gate = gates[corridor]
    // A read that failed says nothing about what the user holds, so a deep link
    // must not resolve past the list: the empty fallback map would read as "not
    // claimed yet" and offer to open an account the user may already have. The
    // list carries the error and the retry.
    //
    // A corridor the user has no rail for goes the same way. `?corridor=` is a
    // user input, and a stale link naming ARS must not open an Argentine screen
    // for somebody in Germany. Only once the corridors are known, though —
    // before that every corridor looks absent.
    // A residence-gated corridor is offered to everybody: the row exists for
    // every user, and the screen behind it is what explains the rule.
    const offered = isLoading || corridors.includes(corridor) || isResidenceGated(corridor)
    const terms = claimable?.[corridor]
    // With claims off, a link to the claim step lands on the list; details of
    // a held account resolve as they always do.
    const withClaimsGate = (next: DepositAccountScreen): DepositAccountScreen =>
        next === 'claim' && !claimsEnabled ? 'list' : next
    const resolved =
        isError || !offered || namesUnknownCorridor
            ? 'list'
            : withClaimsGate(resolveScreen(screen, rail, account, gate, terms))

    // A user who asked for a screen and was handed a lesser one hit the gate.
    // Reported per corridor and per gate kind, because "blocked" as one number
    // cannot tell a queue waiting on a provider from users with a button to press.
    const gateBlocked = !isLoading && !isError && screen !== 'list' && resolved !== screen && gate.kind !== 'ready'
    useEffect(() => {
        if (gateBlocked) trackGateBlocked(corridor, gate.kind)
    }, [gateBlocked, corridor, gate.kind])

    const resumeReady =
        !!resumeCorridor &&
        screen === 'list' &&
        !isLoading &&
        !isError &&
        withClaimsGate(
            resolveScreen(
                'claim',
                DEPOSIT_RAILS[resumeCorridor],
                accounts[resumeCorridor],
                gates[resumeCorridor],
                claimable?.[resumeCorridor]
            )
        ) !== 'list'
    useEffect(() => {
        if (!resumeReady || !resumeCorridor) return
        setResumeCorridor(undefined)
        setParams({ corridor: resumeCorridor, step: 'claim' })
    }, [resumeReady, resumeCorridor, setParams])

    // the client's own timeout is reported as its own state — a details view
    // that gave up is not the same event as one still waiting
    const viewedStatus =
        resolved === 'details' && account ? (account.timedOut ? 'timed-out' : account.status) : undefined
    useEffect(() => {
        if (viewedStatus) trackDetailsViewed(corridor, viewedStatus)
    }, [viewedStatus, corridor])

    // Which screen is right depends on whether the user already holds this
    // corridor, and that is a network answer. Resolving before it arrives reads
    // a missing account as "not claimed yet" and offers to open one the user may
    // already have — so a deep link to your own details would show the claim
    // screen first. The list has its own loading state and keeps it.
    if (isLoading && resolved !== 'list') {
        return (
            <PageStack>
                <NavHeader title={t('list.addTitle')} onPrev={onExit} />
                <div className="flex flex-col gap-6">
                    {/* Real heading and status line — only the card underneath is a
                        skeleton, so a claimed corridor reads as "your account is
                        coming" rather than an unlabelled loading box. */}
                    <TitleBlock
                        size="s"
                        title={t('details.heading', { currency: rail.currency, rail: railName(rail.corridor) })}
                        description={t('details.provisioning')}
                    />
                    <DepositDetailsSkeleton rows={rail.detailRowCount} />
                </div>
            </PageStack>
        )
    }

    /**
     * The gate, where the user asked for a corridor they cannot open yet.
     *
     * It used to be a banner over the whole list, which told a user holding two
     * Ready accounts to verify their identity. It belongs here: one corridor,
     * its own reason, and the button that clears it.
     */
    // A failed claim can leave the backend briefly reporting an account cap for
    // a user who holds nothing: on staging the shared provider customer already
    // has accounts this user never opened, so the read right after a failure can
    // say "at the limit". "You already have two accounts" is provably wrong to a
    // user looking at zero, so the cap screen only renders when the client can
    // see the accounts it names; otherwise the honest "we couldn't open an
    // account" support screen shows. "Names" means takes a slot: a revoked
    // account is held and the cap does not count it.
    const rawGateNotice = depositGateView(gate, terms).notice
    /*
     * The other way into this corridor: a transfer the user sends themselves,
     * which needs no account and no free account slot. It is what the gate
     * screen offers beside the block, because a user at the account cap can
     * deposit on this rail today and the screen used to send them to support
     * instead.
     *
     * It needs a country live for the corridor AND a `ready` gate. The gate is
     * not about the account — it is whether this user's verification permits
     * the corridor at all, and the deposit route refuses a user with no enabled
     * rail for it.
     */
    const hasTopUp = corridorHasTopUp(corridor) && gate.kind === 'ready'
    // The provider hands out its page only for a review it still takes from the
    // user. One it rejected or revoked has none, and the claim says so by
    // answering without a link; the preview names those two in its issues.
    const reviewClosed = (terms?.requirements?.issues ?? []).some((issue) =>
        ['rejected', 'revoked'].includes(issue.toLowerCase())
    )
    const canFinishReview = !!review && !reviewClosed && !review.needsSupport.has(corridor)
    /**
     * Why the BACKEND withholds this corridor, where it said so.
     *
     * It answers for this user. The capability gate answers for the rail, and
     * `needs-enrollment` is its answer both for "no rail here yet" and for a
     * user whose identity check ended terminally. The hub badges that second
     * case "Contact support" and the row leads here, so without this the
     * destination offered a verification run that cannot help them, under a
     * badge that said otherwise — a row naming an action the user cannot take
     * (design.md, "rows the user cannot act on").
     *
     * Only the identity-shaped answers are replaced. A terms block or a missing
     * email is a precise, actionable reason, and the backend's coarser one must
     * not overwrite it.
     */
    const withheld = unavailable?.[corridor]?.reason
    const withheldAction =
        (withheld === 'support-required' || withheld === 'identity-required') &&
        (!rawGateNotice || rawGateNotice.action === 'verify' || rawGateNotice.action === 'none')
            ? withheld === 'support-required'
                ? ('support' as const)
                : ('verify' as const)
            : undefined
    const gateNotice = withheldAction
        ? { kind: gate.kind, message: rawGateNotice?.message ?? null, action: withheldAction }
        : rawGateNotice?.action === 'account-limit' && slotsHeld === 0
          ? { ...rawGateNotice, action: 'support' as const }
          : rawGateNotice?.action === 'finish-review' && !canFinishReview
            ? { ...rawGateNotice, action: 'finish-review-support' as const }
            : rawGateNotice
    // The gate belongs to this corridor only while the user cannot open it. The
    // drawer stays mounted after it closes (`?step=list`, same corridor), so
    // it slides out instead of vanishing.
    const gateApplies =
        claimsEnabled && !namesUnknownCorridor && !isLoading && !isError && isClaimable(rail) && !isHeld(account)
    const gateOpen = gateApplies && screen !== 'list' && !!gateNotice
    const closeGate = () => setParams({ step: 'list' })
    const gateDrawer =
        gateApplies && gateNotice ? (
            <CorridorGateDrawer
                open={gateOpen}
                rail={rail}
                notice={gateNotice}
                slotsHeld={slotsHeld}
                isActing={review?.startingCorridor === corridor}
                actFailed={review?.failedCorridor === corridor}
                onTopUp={hasTopUp && onTopUp ? () => onTopUp(corridor) : undefined}
                onClose={closeGate}
                onAct={() => {
                    // The provider's page opens in another tab, and the drawer
                    // shows its progress and its failure — it stays open.
                    if (gateNotice.action === 'finish-review') {
                        return void review?.start(corridor)
                    }
                    // Every other button opens a sheet of its own (verification,
                    // terms, email, support). Those sit below a drawer, so this
                    // one closes first, and the sheet opens once it has slid out:
                    // a sheet opened under the closing overlay can miss its first tap.
                    const afterGateCloses = (act: () => void) => {
                        closeGate()
                        clearTimeout(pendingGateAct.current)
                        pendingGateAct.current = setTimeout(act, DRAWER_CLOSE_MS)
                    }
                    // A corridor the backend withheld for support is not
                    // something the capability gate can resolve: its own answer
                    // here is a verification run that cannot lift the block.
                    if (withheldAction === 'support') {
                        return afterGateCloses(() => onContactSupport(corridor, 'blocked'))
                    }
                    // A block from the backend's own terms has nothing for the
                    // capability gate to resolve, whatever that gate reads.
                    if (!isDepositBlock(gateNotice.kind)) {
                        setResumeCorridor(corridor)
                        return afterGateCloses(() => onResolveGate(gate, corridor))
                    }
                    const reason =
                        gateNotice.action === 'finish-review-support'
                            ? 'review'
                            : gateNotice.action === 'account-limit'
                              ? 'account-limit'
                              : 'blocked'
                    return afterGateCloses(() => onContactSupport(corridor, reason))
                }}
            />
        ) : null
    // While the gate is open the list stays on screen underneath it.
    const view = gateOpen ? 'list' : resolved

    const openCorridor = (next: DepositCorridor) => {
        setOpeningCorridor(undefined)
        setResumeCorridor(undefined)
        const nextAccount = accounts[next]
        // only a corridor a user can hold has something to claim; the rest go
        // straight to their details, which are the user's own top-up details
        const needsClaim = isClaimable(DEPOSIT_RAILS[next]) && (!nextAccount || nextAccount.status === 'unclaimed')
        setParams({ corridor: next, step: needsClaim ? 'claim' : 'details' })
    }

    // The provider closed a corridor the user holds an account on. There are no
    // details left to render, so the screen says so and offers the way in that
    // still works.
    if (view === 'details' && account?.status === 'unavailable') {
        return <CorridorUnavailableScreen rail={rail} onBack={() => setParams({ step: 'list' })} />
    }

    if (view === 'claim') {
        // a failure on another corridor is not this screen's news
        const failure = claimError?.corridor === corridor ? claimError : undefined
        return (
            <ClaimAccountScreen
                rail={rail}
                terms={terms}
                userName={userName}
                isClaiming={claimingCorridor === corridor}
                // the localized sentence for the wire code, never the backend's own
                error={failure && claimErrorBody(failure.code, failure.status)}
                onContactSupport={
                    failure && claimErrorOffersSupport(claimErrorKey(failure.code, failure.status))
                        ? () => onContactSupport(corridor, 'blocked')
                        : undefined
                }
                isUnavailable={failure?.unavailable}
                // no screen change here: once the account exists, resolveScreen
                // moves the user on by itself, and if it never does the error
                // renders on this screen rather than nowhere
                onClaim={() => {
                    setOpeningCorridor(corridor)
                    onClaim(corridor)
                }}
                onBack={() => {
                    setOpeningCorridor(undefined)
                    setParams({ step: 'list' })
                }}
            />
        )
    }

    if (view === 'details' && account) {
        // Celebrate only a claim made here, once Bridge has supplied usable details.
        if (
            openingCorridor === corridor &&
            account.status === 'active' &&
            account.instructions &&
            gate.kind === 'ready'
        ) {
            return (
                <AccountOpenedScreen
                    currency={rail.currency}
                    onContinue={() => {
                        setOpeningCorridor(undefined)
                        setParams({ step: 'details' })
                    }}
                />
            )
        }
        return (
            <DepositAccountDetailsScreen
                rail={rail}
                account={account}
                userName={userName}
                canShare={canShare(account, gate)}
                onBack={() => (visitedList.current ? setParams({ step: 'list' }) : onExit())}
                onRetry={() => onClaim(corridor)}
                onContactSupport={() => onContactSupport(corridor, 'revoked')}
            />
        )
    }

    return (
        <>
            <DepositAccountsListScreen
                corridors={corridors}
                accounts={accounts}
                claimable={claimable}
                unavailable={unavailable}
                slotsHeld={slotsHeld}
                accountLimit={accountLimit}
                gates={gates}
                isLoading={isLoading}
                isError={isError}
                onBack={onExit}
                onOpen={openCorridor}
                onRetry={onRetry}
            />
            {gateDrawer}
        </>
    )
}
