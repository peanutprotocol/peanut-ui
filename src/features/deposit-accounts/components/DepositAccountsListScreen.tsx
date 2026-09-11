'use client'

import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Section } from '@/components/0_Bruddle/Section'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import NavHeader from '@/components/Global/NavHeader'
import type { GateState } from '@/utils/capability-gate'
import { depositGateView } from '../depositGate'
import { DEPOSIT_RAILS, DEPOSIT_RAIL_ORDER, isClaimable } from '../rails'
import type { DepositAccount, DepositCorridor } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { CorridorFlag } from './CorridorFlag'
import { DepositGateNotice } from './DepositGateNotice'

/**
 * The hub: every corridor this user could hold, and where each one stands.
 *
 * Eligibility is settled here, before any details exist. The failure worth
 * designing against is a user who deposits first and learns their region is
 * unsupported afterwards, when the money has already left.
 */
export function DepositAccountsListScreen({
    accounts,
    gate,
    onOpen,
    onResolveGate,
}: {
    accounts: Record<DepositCorridor, DepositAccount | undefined>
    /** the app's own answer to "can this user deposit by bank" — never a local flag */
    gate: GateState
    onOpen: (corridor: DepositCorridor) => void
    onResolveGate: () => void
}) {
    const { t, arrival, railName, unclaimableReason } = useDepositAccountCopy()
    const { claimable, notice } = depositGateView(gate)

    const rowBody = (corridor: DepositCorridor, account: DepositAccount | undefined): string => {
        const unclaimable = unclaimableReason(corridor)
        if (unclaimable) return unclaimable
        if (!claimable) return t('list.rowBlocked')
        const params = { arrival: arrival(corridor) }
        if (!account || account.status === 'unclaimed') return t('list.rowUnclaimed', params)
        if (account.status === 'provisioning') return t('list.rowProvisioning')
        if (account.status === 'failed') return t('list.rowFailed')
        if (account.status === 'revoked') return t('list.rowRevoked')
        if (account.status === 'unavailable') return t('list.rowUnavailable')
        return t('list.rowReady', params)
    }

    // a corridor that cannot be held as an account still works for the user's
    // own top-up, so it gets no badge — the body line carries the difference
    const rowBadge = (account: DepositAccount | undefined) => {
        if (account?.status === 'active') return <StatusBadge status="completed" customText={t('list.badgeReady')} />
        if (account?.status === 'provisioning') return <StatusBadge status="pending" />
        if (account?.status === 'failed') return <StatusBadge status="failed" />
        if (account?.status === 'revoked') return <StatusBadge status="closed" />
        return undefined
    }

    return (
        <PageStack>
            <NavHeader title={t('title')} hideBackBtn />
            <div className="flex flex-col gap-6">
                <TitleBlock size="s" title={t('list.heading')} description={t('list.subheading')} />

                {notice && <DepositGateNotice notice={notice} onAct={onResolveGate} />}

                <Section title={t('list.sectionTitle')}>
                    <ListGroup>
                        {DEPOSIT_RAIL_ORDER.map((corridor) => {
                            const rail = DEPOSIT_RAILS[corridor]
                            const account = accounts[corridor]

                            return (
                                <ListItem
                                    key={corridor}
                                    leading={<CorridorFlag iso2={rail.flagIso2} />}
                                    title={`${rail.currency} · ${railName(corridor)}`}
                                    body={rowBody(corridor, account)}
                                    bodyWrap
                                    trailing={isClaimable(rail) ? rowBadge(account) : undefined}
                                    chevron={claimable}
                                    disabled={!claimable}
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
