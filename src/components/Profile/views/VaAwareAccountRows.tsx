'use client'

import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { Section } from '@/components/0_Bruddle/Section'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Callout } from '@/components/0_Bruddle/Callout'
import Badge from '@/components/Global/Badges/Badge'
import { CorridorFlag } from '@/features/deposit-accounts/components/CorridorFlag'
import { DEPOSIT_RAIL_ORDER, DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import { canShare, isHeld } from '@/features/deposit-accounts/resolveScreen'
import { useDepositAccountCopy } from '@/features/deposit-accounts/useDepositAccountCopy'
import { useDepositAccounts } from '@/features/deposit-accounts/useDepositAccounts'
import { withReturnTo } from '@/utils/return-to.utils'
import { dedupeHeldBankRows, type UnlockRow } from '@/utils/unlock-payments.utils'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { bankListItems } from './bankListItems'

/**
 * The two sections, with the user's own accounts in the first one. Mounted
 * only while the accounts rollout flag is on, so the accounts fetch never
 * fires otherwise.
 *
 * The account numbers section appears only where the user holds one: an empty
 * section under a heading that names account numbers is a promise of something
 * that is not there.
 *
 * Two account facts are kept apart here. HELD (any account that exists,
 * revoked included) decides which account rows show. ACTIVE decides which
 * bank rows an account row replaces. Per-corridor limits are not shown here
 * at all — each row states its own in its details drawer (2026-09-21).
 */
export default function VaAwareAccountRows({
    bankRows,
    onRowClick,
    isKycDegraded,
}: {
    bankRows: UnlockRow[]
    onRowClick: (row: UnlockRow) => void
    isKycDegraded: boolean
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
                    <Badge status="completed" customText={t('list.badgeReady')} />
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
                <Callout priority="error" ctas={[{ label: t('list.errorRetry'), onClick: refetch }]}>
                    {t('list.errorBody')}
                </Callout>
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
            </Section>
        </>
    )
}
