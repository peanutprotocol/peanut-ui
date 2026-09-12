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
import type { DepositAccount, DepositCorridor } from '../types'
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
    const { t, arrival, railName, unclaimableReason } = useDepositAccountCopy()

    const views = DEPOSIT_RAIL_ORDER.map((corridor) => ({ corridor, view: depositGateView(gates[corridor]) }))
    // The banner names the first corridor the user could hold but cannot. Every
    // corridor normally shares one blocker (identity), so this is one sentence
    // rather than six; where they differ, the row's own body says so.
    const blocked = views.find(({ corridor, view }) => isClaimable(DEPOSIT_RAILS[corridor]) && view.notice)

    const rowBody = (corridor: DepositCorridor, account: DepositAccount | undefined, claimable: boolean): string => {
        // The corridors come from a local catalogue and the accounts from the
        // network, so the rows can paint before anything is known about them.
        // Saying "not set up yet" in that gap is a wrong answer that corrects
        // itself a moment later — the arrival time is true either way.
        if (isLoading) return arrival(corridor)
        const unclaimable = unclaimableReason(corridor)
        if (unclaimable) return unclaimable
        if (!claimable) return t('list.rowBlocked')
        const params = { arrival: arrival(corridor) }
        if (!account || account.status === 'unclaimed') return t('list.rowUnclaimed', params)
        if (account.status === 'provisioning') return t('list.rowProvisioning')
        if (account.status === 'failed') return t('list.rowFailed')
        if (account.status === 'revoked') return t('list.rowRevoked')
        if (account.status === 'unavailable') return t('list.rowUnavailable')
        // "Ready to share" is a promise about a payer, not about the account,
        // so it is only true where somebody else may pay in at all
        if (!isShareable(account.matching.sender)) return t('list.rowActive', params)
        return t('list.rowReady', params)
    }

    // a corridor that cannot be held as an account still works for the user's
    // own top-up, so it gets no badge — the body line carries the difference
    const rowBadge = (account: DepositAccount | undefined) => {
        if (isLoading) return <div className="h-5 w-16 animate-pulse rounded bg-foreground-primary/10" />
        if (account?.status === 'active')
            return (
                <StatusBadge
                    status="completed"
                    customText={isShareable(account.matching.sender) ? t('list.badgeReady') : t('list.badgeActive')}
                />
            )
        if (account?.status === 'provisioning') return <StatusBadge status="pending" />
        if (account?.status === 'failed') return <StatusBadge status="failed" />
        if (account?.status === 'revoked') return <StatusBadge status="closed" />
        return undefined
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
                            // a corridor with no standing account to claim is
                            // still worth opening: its details are the user's
                            // own top-up route, and no gate governs reading them
                            const openable = isClaimable(rail) ? view.claimable : true
                            const disabled = isError || isLoading || !openable

                            return (
                                <ListItem
                                    key={corridor}
                                    leading={<CorridorFlag iso2={rail.flagIso2} />}
                                    title={`${rail.currency} · ${railName(corridor)}`}
                                    body={rowBody(corridor, account, openable)}
                                    bodyWrap
                                    trailing={isClaimable(rail) ? rowBadge(account) : undefined}
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
