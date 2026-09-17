'use client'

import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Notification } from '@/components/0_Bruddle/Notification'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Section } from '@/components/0_Bruddle/Section'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import type { GateState } from '@/utils/capability-gate'
import { depositGateView } from '../depositGate'
import { DEPOSIT_RAILS, isClaimable } from '../rails'
import { canShare, isHeld } from '../resolveScreen'
import type { DepositAccountView, DepositCorridor, DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { DepositGateNotice } from './DepositGateNotice'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import Image from 'next/image'

/**
 * The hub: every corridor this user could hold, and where each one stands.
 *
 * The rows come from the user's own rails, so a corridor they have no rail for
 * is absent rather than present and unavailable — a German user reading an
 * "Unavailable" ARS row learns nothing and doubts the four rows above it.
 *
 * Eligibility is settled here, before any details exist, and per corridor. The
 * failure worth designing against is a user who deposits first and learns
 * their region is unsupported afterwards, when the money has already left —
 * and its near twin, a user whose working US rail made a blocked EUR row look
 * tappable.
 */
// Follow-up: evaluate 1–2 included accounts and a Peanut Tier 2 unlock for more.
// Billing and backend enforcement decisions: mono/projects/virtual-accounts/README.md, Next steps.
export function DepositAccountsListScreen({
    corridors,
    accounts,
    gates,
    isLoading,
    isError,
    onBack,
    onOpen,
    onResolveGate,
    onRetry,
}: {
    /** the corridors this user has a rail for, in catalogue order */
    corridors: DepositCorridor[]
    accounts: Record<DepositCorridor, DepositAccountView | undefined>
    /** the app's own answer to "can this user deposit here" — one gate per corridor */
    gates: Record<DepositCorridor, GateState>
    /** the corridors and the accounts are both network answers */
    isLoading: boolean
    /** the accounts could not be read at all */
    isError: boolean
    onBack: () => void
    onOpen: (corridor: DepositCorridor) => void
    onResolveGate: (gate: GateState) => void
    onRetry: () => void
}) {
    const { t, arrival, railName } = useDepositAccountCopy()

    const views = corridors.map((corridor) => ({ corridor, view: depositGateView(gates[corridor]) }))
    // The banner names one corridor the user could hold but cannot. Every
    // corridor normally shares one blocker (identity), so this is one sentence
    // rather than six; where they differ, the row's own body says so.
    //
    // Where they differ, a blocker the user can clear outranks one that only
    // says to wait — otherwise a SEPA queue hides the button that would unlock
    // the other five corridors.
    const blockedViews = views.filter(({ corridor, view }) => isClaimable(DEPOSIT_RAILS[corridor]) && view.notice)
    const blocked = blockedViews.find(({ view }) => view.notice?.action !== 'none') ?? blockedViews[0]

    // Status lives in the badge on every row, so the body only ever answers
    // "when does the money land". Saying it in both places is how a row ended
    // up reading "Not set up yet" under a "Ready" pill.
    const rowBody = (corridor: DepositCorridor, openable: boolean): string => {
        // The rows can paint before the accounts arrive. The arrival time is
        // true in that gap too; the status is not, so the badge carries it.
        if (isLoading) return arrival(corridor)
        // A revoked row is closed, not blocked: "verify your identity" would be
        // an instruction that changes nothing. The badge says revoked and the
        // body says what a payer sending money there gets.
        if (accounts[corridor]?.status === 'revoked') return t('list.rowRevoked')
        if (!openable) return t('list.rowBlocked')
        return arrival(corridor)
    }

    /**
     * Where the corridor stands, in the one slot that carries status.
     *
     * A corridor nobody can hold as a standing account is unavailable whatever
     * the accounts call returned, so the rail decides that case rather than the
     * payload — a failed read must not invite a claim on AR or BR.
     */
    const rowBadge = (rail: DepositRail, account: DepositAccountView | undefined, gate: GateState) => {
        if (isLoading) return <div className="h-5 w-16 animate-pulse rounded bg-foreground-primary/10" />
        if (!isClaimable(rail) || account?.status === 'unavailable')
            return <StatusBadge status="custom" customText={t('list.badgeUnavailable')} />
        // A read that failed says nothing about what the user holds. "Not set
        // up" is a claim about their account, and the fallback map cannot make
        // it — the notice above owns this state.
        if (isError) return null
        if (account?.timedOut) return <StatusBadge status="failed" />
        switch (account?.status) {
            case 'active':
            case 'retiring':
                return (
                    <StatusBadge
                        status="completed"
                        // "Ready" means a payer can be handed these details
                        // today — the same answer the details footer gives
                        customText={canShare(account, gate) ? t('list.badgeReady') : t('list.badgeActive')}
                    />
                )
            case 'provisioning':
                return <StatusBadge status="pending" />
            case 'revoked':
                return <StatusBadge status="closed" customText={t('list.badgeRevoked')} />
            default:
                return <StatusBadge status="custom" customText={t('list.badgeNotSetUp')} />
        }
    }

    return (
        <PageStack>
            <NavHeader title={t('title')} onPrev={onBack} />
            <div className="flex flex-col gap-6">
                <TitleBlock size="s" title={t('list.heading')} description={t('list.subheading')} />

                {/*
                 * A read that failed is not "you hold nothing". Without this the
                 * empty fallback map renders as six unclaimed corridors and the
                 * user is invited to open an account they may already have.
                 */}
                {isError && (
                    <Notification
                        priority="error"
                        title={t('list.errorTitle')}
                        ctas={[{ label: t('list.errorRetry'), onClick: onRetry }]}
                    >
                        {t('list.errorBody')}
                    </Notification>
                )}

                {!isError && blocked?.view.notice && (
                    <DepositGateNotice
                        notice={blocked.view.notice}
                        onAct={() => onResolveGate(gates[blocked.corridor])}
                    />
                )}

                {/*
                 * No bank rail at all, so there is no corridor to offer. Saying
                 * so is the honest answer; an empty list under a section title
                 * reads as a screen that failed to load.
                 */}
                {!isError && !isLoading && corridors.length === 0 ? (
                    <EmptyState icon="globe-lock" title={t('list.emptyTitle')} description={t('list.emptyBody')} />
                ) : (
                    <Section title={t('list.sectionTitle')}>
                        <ListGroup>
                            {views.map(({ corridor, view }) => {
                                const rail = DEPOSIT_RAILS[corridor]
                                const account = accounts[corridor]
                                // The gate governs opening a NEW account, not
                                // reading one that already exists — resolveScreen
                                // serves those details read-only. A corridor with
                                // nothing to claim is always open: its details are
                                // the user's own top-up route.
                                // Revoked details still explain returned payments and provide support.
                                const openable = !isClaimable(rail) || view.claimable || isHeld(account)
                                const disabled = isError || isLoading || !openable

                                return (
                                    <ListItem
                                        key={corridor}
                                        leading={<CorridorFlag iso2={rail.flagIso2} />}
                                        /* a ReactNode title wraps; a bare
                                           string is truncated to one line, and
                                           "GBP · Faster Payments" does not fit
                                           at 375 */
                                        title={<span>{`${rail.currency} · ${railName(corridor)}`}</span>}
                                        body={rowBody(corridor, openable)}
                                        bodyWrap
                                        trailing={rowBadge(rail, account, gates[corridor])}
                                        chevron={!disabled}
                                        disabled={disabled}
                                        onClick={() => onOpen(corridor)}
                                        data-testid={`deposit-account-${corridor}`}
                                    />
                                )
                            })}
                        </ListGroup>
                    </Section>
                )}
            </div>
        </PageStack>
    )
}

/**
 * ListItem leading for a corridor row. The list-item usage board
 * (17312:136171) lists a flag as a valid leading but no flag primitive exists,
 * so this mirrors the shipped `AddWithdrawCountriesList` leading: one 32px
 * round image, no overlay. Flagged in the PR, not invented.
 */
function CorridorFlag({ iso2 }: { iso2: string }) {
    return (
        <Image
            src={getFlagUrl(iso2)}
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-round object-cover"
        />
    )
}
