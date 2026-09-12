'use client'

import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Notification } from '@/components/0_Bruddle/Notification'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Section } from '@/components/0_Bruddle/Section'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import NavHeader from '@/components/Global/NavHeader'
import type { GateState } from '@/utils/capability-gate'
import { depositGateView } from '../depositGate'
import { DEPOSIT_RAILS, DEPOSIT_RAIL_ORDER, isClaimable, isShareable } from '../rails'
import { isHeld } from '../resolveScreen'
import type { DepositAccount, DepositCorridor, DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { CorridorFlag } from './CorridorFlag'
import { DepositGateNotice } from './DepositGateNotice'

/**
 * The hub: every corridor this user could hold, and where each one stands.
 *
 * Eligibility is settled here, before any details exist, and per corridor. The
 * failure worth designing against is a user who deposits first and learns
 * their region is unsupported afterwards, when the money has already left —
 * and its near twin, a user whose working US rail made a blocked EUR row look
 * tappable.
 */
export function DepositAccountsListScreen({
    accounts,
    gates,
    isLoading,
    isError,
    onBack,
    onOpen,
    onResolveGate,
    onRetry,
}: {
    accounts: Record<DepositCorridor, DepositAccount | undefined>
    /** the app's own answer to "can this user deposit here" — one gate per corridor */
    gates: Record<DepositCorridor, GateState>
    /** the corridor catalogue is static, but which of them the user holds is not */
    isLoading: boolean
    /** the accounts could not be read at all */
    isError: boolean
    onBack: () => void
    onOpen: (corridor: DepositCorridor) => void
    onResolveGate: (gate: GateState) => void
    onRetry: () => void
}) {
    const { t, arrival, railName } = useDepositAccountCopy()

    const views = DEPOSIT_RAIL_ORDER.map((corridor) => ({ corridor, view: depositGateView(gates[corridor]) }))
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
        // The corridors come from a local catalogue and the accounts from the
        // network, so the rows can paint before anything is known about them.
        // The arrival time is true in that gap too.
        if (isLoading) return arrival(corridor)
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
    const rowBadge = (rail: DepositRail, account: DepositAccount | undefined) => {
        if (isLoading) return <div className="h-5 w-16 animate-pulse rounded bg-foreground-primary/10" />
        if (!isClaimable(rail) || account?.status === 'unavailable')
            return <StatusBadge status="custom" customText={t('list.badgeUnavailable')} />
        switch (account?.status) {
            case 'active':
            case 'retiring':
                return (
                    <StatusBadge
                        status="completed"
                        customText={isShareable(account.matching.sender) ? t('list.badgeReady') : t('list.badgeActive')}
                    />
                )
            case 'provisioning':
                return <StatusBadge status="pending" />
            case 'failed':
                return <StatusBadge status="failed" />
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
                            const openable = !isClaimable(rail) || view.claimable || isHeld(account)
                            const disabled = isError || isLoading || !openable

                            return (
                                <ListItem
                                    key={corridor}
                                    leading={<CorridorFlag iso2={rail.flagIso2} />}
                                    title={`${rail.currency} · ${railName(corridor)}`}
                                    body={rowBody(corridor, openable)}
                                    bodyWrap
                                    trailing={rowBadge(rail, account)}
                                    chevron={!disabled}
                                    disabled={disabled}
                                    onClick={() => onOpen(corridor)}
                                    data-testid={`deposit-account-${corridor}`}
                                />
                            )
                        })}
                    </ListGroup>
                </Section>
            </div>
        </PageStack>
    )
}
