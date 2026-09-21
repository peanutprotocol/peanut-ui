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
 * The two ways money reaches a Peanut balance, named apart (2026-09-20).
 *
 * "Your account numbers" holds the standing accounts: bank details in the
 * user's name that somebody else can pay into, again and again. "Ways to send
 * yourself money" holds the corridors the user's verification opens: a
 * transfer or a code minted per payment, which needs no account number at all.
 * They were one list called "Your accounts", under a subtitle that promised
 * account numbers to share — false of every Brazilian and Argentine row in it,
 * and false of every row while the user held no account.
 *
 * The VA fetch stays conditionally MOUNTED (not just gated by an `enabled`
 * option) on `useDepositAccountsEnabled()`: `VaAwareAccountRows` owns the
 * `useDepositAccounts()` call, so it is never made while the rollout flag is
 * off — same contract the old `HeldDepositAccounts` held, pinned by
 * `UnlockPayments.test.tsx`'s "does not query bank accounts while their
 * rollout flag is off". With the flag off there are no standing accounts at
 * all, so the screen shows the second section alone.
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

    if (depositAccountsEnabled) {
        return (
            <VaAwareAccountRows
                bankRows={bankRows}
                onRowClick={onRowClick}
                isKycDegraded={isKycDegraded}
                mantecaLimits={mantecaLimits}
                bridgeLimits={bridgeLimits}
                locale={locale}
            />
        )
    }

    return (
        <Section title={t('waysTitle')}>
            <p className="text-body-s text-foreground-secondary">{t('waysSubtitle')}</p>
            <ListGroup>{bankListItems(bankRows, onRowClick, isKycDegraded, t)}</ListGroup>
            <MethodLimits
                noLimit={false}
                summaries={limitSummariesForRows(bankRows, mantecaLimits, bridgeLimits, locale)}
            />
        </Section>
    )
}
