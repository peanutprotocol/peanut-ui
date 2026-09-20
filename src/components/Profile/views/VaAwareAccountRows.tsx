'use client'

import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { Section } from '@/components/0_Bruddle/Section'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Notification } from '@/components/0_Bruddle/Notification'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { CorridorFlag } from '@/features/deposit-accounts/components/CorridorFlag'
import { DEPOSIT_RAIL_ORDER, DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import { canShare, isHeld } from '@/features/deposit-accounts/resolveScreen'
import { useDepositAccountCopy } from '@/features/deposit-accounts/useDepositAccountCopy'
import { useDepositAccounts } from '@/features/deposit-accounts/useDepositAccounts'
import type { BridgeLimits, MantecaLimit } from '@/interfaces/interfaces'
import { withReturnTo } from '@/utils/return-to.utils'
import { dedupeHeldBankRows, type UnlockRow } from '@/utils/unlock-payments.utils'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { bankListItems } from './bankListItems'
import { limitSummariesForRows, MethodLimits } from './MethodLimits'

/**
 * The two sections, with the user's own accounts in the first one. Mounted
 * only while the accounts rollout flag is on, so the accounts fetch never
 * fires otherwise.
 *
 * The account numbers section appears only where the user holds one: an empty
 * section under a heading that names account numbers is a promise of something
 * that is not there.
 *
 * Three account facts are kept apart here. HELD (any account that exists,
 * revoked included) decides which account rows show. ACTIVE decides which
 * bank rows an account row replaces. The limits are read from every bank row,
 * replaced or not: hiding a duplicate row must not hide its limit.
 */
export default function VaAwareAccountRows({
    bankRows,
    onRowClick,
    isKycDegraded,
    mantecaLimits,
    bridgeLimits,
    locale,
}: {
    bankRows: UnlockRow[]
    onRowClick: (row: UnlockRow) => void
    isKycDegraded: boolean
    mantecaLimits: MantecaLimit[] | null
    bridgeLimits: BridgeLimits | null
    locale: string
}) {
    const { accounts, gates, isLoading, isError, refetch } = useDepositAccounts()
    const { t, railName } = useDepositAccountCopy()
    const tRows = useTranslations('profile.unlockPayments')
    const router = useRouter()
    const held = DEPOSIT_RAIL_ORDER.filter((corridor) => isHeld(accounts[corridor]))
    const activeCurrencies = new Set(
        held
            .filter((corridor) => accounts[corridor]?.status === 'active')
            .map((corridor) => DEPOSIT_RAILS[corridor].currency)
    )

    /** one standing account: what it pays in, whether a payer can be handed it, and its details */
    const heldRow = (corridor: (typeof held)[number]) => (
        <ListItem
            key={corridor}
            // a ReactNode title wraps, as the hub's rows do;
            // "GBP · Faster Payments" does not fit at 375
            title={<span>{`${DEPOSIT_RAILS[corridor].currency} · ${railName(corridor)}`}</span>}
            leading={<CorridorFlag iso2={DEPOSIT_RAILS[corridor].flagIso2} />}
            trailing={
                canShare(accounts[corridor], gates[corridor]) ? (
                    <StatusBadge status="completed" customText={t('list.badgeReady')} />
                ) : undefined
            }
            chevron
            onClick={() =>
                router.push(
                    withReturnTo(
                        `/add-money?method=bank&step=details&corridor=${corridor}`,
                        '/profile/accounts-and-payments'
                    )
                )
            }
        />
    )

    return (
        <>
            {isError && (
                <Notification priority="error" ctas={[{ label: t('list.errorRetry'), onClick: refetch }]}>
                    {t('list.errorBody')}
                </Notification>
            )}
            {!isLoading && held.length > 0 && (
                <Section title={tRows('accountsTitle')}>
                    <p className="text-body-s text-foreground-secondary">{tRows('accountsSubtitle')}</p>
                    <ListGroup>{held.map(heldRow)}</ListGroup>
                </Section>
            )}
            <Section title={tRows('waysTitle')}>
                <p className="text-body-s text-foreground-secondary">{tRows('waysSubtitle')}</p>
                <ListGroup>
                    {bankListItems(dedupeHeldBankRows(bankRows, activeCurrencies), onRowClick, isKycDegraded, tRows)}
                </ListGroup>
                <MethodLimits
                    noLimit={false}
                    summaries={limitSummariesForRows(bankRows, mantecaLimits, bridgeLimits, locale)}
                />
            </Section>
        </>
    )
}
