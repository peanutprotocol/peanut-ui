'use client'

import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Section } from '@/components/0_Bruddle/Section'
import { Notification } from '@/components/0_Bruddle/Notification'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { CorridorFlag } from '@/features/deposit-accounts/components/CorridorFlag'
import { DEPOSIT_RAIL_ORDER, DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import { canShare, isHeld } from '@/features/deposit-accounts/resolveScreen'
import { useDepositAccounts } from '@/features/deposit-accounts/useDepositAccounts'
import { useDepositAccountsEnabled } from '@/features/deposit-accounts/useDepositAccountsEnabled'
import { useDepositAccountCopy } from '@/features/deposit-accounts/useDepositAccountCopy'
import { withReturnTo } from '@/utils/return-to.utils'
import { dedupeHeldBankRows, type UnlockRow } from '@/utils/unlock-payments.utils'
import { rowStatusBadge, isRowTappable } from './RowStatusBadge'
import { limitSummariesForRows, MethodLimits } from './MethodLimits'
import type { MantecaLimit, BridgeLimits } from '@/interfaces/interfaces'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

/**
 * Currency-first "Your accounts" list (2026-09-18 rework, TASK ui#3271): one
 * merged list for every way money can arrive — held VA standing accounts and
 * the KYC-unlock bank/QR corridors alike — flag-led, one row per corridor,
 * region headers gone. Replaces the old split between "Your bank accounts"
 * (held VA only) and separate South America/North America/Europe sections.
 *
 * The VA fetch stays conditionally MOUNTED (not just gated by an `enabled`
 * option) on `useDepositAccountsEnabled()`, so `useDepositAccounts()` is
 * never called at all while the rollout flag is off — same contract the old
 * `HeldDepositAccounts` held, pinned by
 * `UnlockPayments.test.tsx`'s "does not query bank accounts while their
 * rollout flag is off".
 */
export default function AccountsList({
    bankRows,
    onRowClick,
    isKycDegraded,
    mantecaLimits,
    bridgeLimits,
    locale,
}: {
    /** the flattened, own-region-first KYC-unlock bank/QR rows (region headers already stripped) */
    bankRows: UnlockRow[]
    onRowClick: (row: UnlockRow) => void
    isKycDegraded: boolean
    mantecaLimits: MantecaLimit[] | null
    bridgeLimits: BridgeLimits | null
    locale: string
}) {
    const t = useTranslations('profile.unlockPayments')
    const depositAccountsEnabled = useDepositAccountsEnabled()

    return (
        <Section title={t('accountsTitle')}>
            <p className="text-body-s text-foreground-secondary">{t('accountsSubtitle')}</p>
            {depositAccountsEnabled ? (
                <VaAwareRows
                    bankRows={bankRows}
                    onRowClick={onRowClick}
                    isKycDegraded={isKycDegraded}
                    mantecaLimits={mantecaLimits}
                    bridgeLimits={bridgeLimits}
                    locale={locale}
                />
            ) : (
                <>
                    <BankRows bankRows={bankRows} onRowClick={onRowClick} isKycDegraded={isKycDegraded} />
                    <MethodLimits
                        noLimit={false}
                        summaries={limitSummariesForRows(bankRows, mantecaLimits, bridgeLimits, locale)}
                    />
                </>
            )}
        </Section>
    )
}

/** Mounted only while the VA rollout flag is on, so the fetch never fires otherwise. */
function VaAwareRows({
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
    const router = useRouter()
    const held = DEPOSIT_RAIL_ORDER.filter((corridor) => isHeld(accounts[corridor]))
    const heldCurrencies = new Set(held.map((corridor) => DEPOSIT_RAILS[corridor].currency))
    // Already covered by a held VA row above — see `dedupeHeldBankRows`.
    const rows = dedupeHeldBankRows(bankRows, heldCurrencies)

    return (
        <>
            {isError && (
                <Notification priority="error" ctas={[{ label: t('list.errorRetry'), onClick: refetch }]}>
                    {t('list.errorBody')}
                </Notification>
            )}
            <ListGroup>
                {!isLoading &&
                    held.map((corridor) => (
                        <ListItem
                            key={corridor}
                            title={`${DEPOSIT_RAILS[corridor].currency} · ${railName(corridor)}`}
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
                                        '/profile/identity-verification'
                                    )
                                )
                            }
                        />
                    ))}
                <BankListItems rows={rows} onRowClick={onRowClick} isKycDegraded={isKycDegraded} />
            </ListGroup>
            <MethodLimits
                noLimit={false}
                summaries={limitSummariesForRows(rows, mantecaLimits, bridgeLimits, locale)}
            />
        </>
    )
}

/** The VA rollout flag is off: the merged list is just the bank/QR rows. */
function BankRows({
    bankRows,
    onRowClick,
    isKycDegraded,
}: {
    bankRows: UnlockRow[]
    onRowClick: (row: UnlockRow) => void
    isKycDegraded: boolean
}) {
    return (
        <ListGroup>
            <BankListItems rows={bankRows} onRowClick={onRowClick} isKycDegraded={isKycDegraded} />
        </ListGroup>
    )
}

/** One row per KYC-unlock bank/QR corridor: flag(s) leading, existing chip/tap behavior unchanged. */
function BankListItems({
    rows,
    onRowClick,
    isKycDegraded,
}: {
    rows: UnlockRow[]
    onRowClick: (row: UnlockRow) => void
    isKycDegraded: boolean
}) {
    const t = useTranslations('profile.unlockPayments')
    return (
        <>
            {rows.map((row) => {
                const tappable = isRowTappable(row, isKycDegraded)
                return (
                    <ListItem
                        key={row.id}
                        className="min-h-18"
                        disabled={row.chip === 'notAvailable'}
                        leading={
                            <div className="flex items-center gap-1">
                                {(row.flags ?? []).map((iso2) => (
                                    <CorridorFlag key={iso2} iso2={iso2} />
                                ))}
                            </div>
                        }
                        title={<span className="break-words whitespace-normal">{t(`rows.${row.labelKey}`)}</span>}
                        trailing={rowStatusBadge(row, t)}
                        chevron={tappable}
                        onClick={tappable ? () => onRowClick(row) : undefined}
                    />
                )
            })}
        </>
    )
}
