'use client'

import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { Section } from '@/components/0_Bruddle/Section'
import { useDepositAccountsEnabled } from '@/features/deposit-accounts/useDepositAccountsEnabled'
import type { UnlockRow } from '@/utils/unlock-payments.utils'
import { bankListItems } from './bankListItems'
import { limitSummariesForRows, MethodLimits } from './MethodLimits'
import VaAwareAccountRows from './VaAwareAccountRows'
import type { MantecaLimit, BridgeLimits } from '@/interfaces/interfaces'
import { useTranslations } from 'next-intl'

/**
 * Currency-first "Your accounts" list (2026-09-18 rework, TASK ui#3271): one
 * merged list for every way money can arrive — held VA standing accounts and
 * the KYC-unlock bank/QR corridors alike — flag-led, one row per corridor,
 * region headers gone. Replaces the old split between "Your bank accounts"
 * (held VA only) and separate South America/North America/Europe sections.
 *
 * The VA fetch stays conditionally MOUNTED (not just gated by an `enabled`
 * option) on `useDepositAccountsEnabled()`: `VaAwareAccountRows` owns the
 * `useDepositAccounts()` call, so it is never made while the rollout flag is
 * off — same contract the old `HeldDepositAccounts` held, pinned by
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
                <VaAwareAccountRows
                    bankRows={bankRows}
                    onRowClick={onRowClick}
                    isKycDegraded={isKycDegraded}
                    mantecaLimits={mantecaLimits}
                    bridgeLimits={bridgeLimits}
                    locale={locale}
                />
            ) : (
                <>
                    {/* the accounts rollout flag is off: the merged list is just the bank/QR rows */}
                    <ListGroup>{bankListItems(bankRows, onRowClick, isKycDegraded, t)}</ListGroup>
                    <MethodLimits
                        noLimit={false}
                        summaries={limitSummariesForRows(bankRows, mantecaLimits, bridgeLimits, locale)}
                    />
                </>
            )}
        </Section>
    )
}
