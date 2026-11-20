'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/context/authContext'
import { useCapabilities } from '@/hooks/useCapabilities'
import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import NavHeader from '@/components/Global/NavHeader'
import CenteredStatusCard from '@/components/Global/EmptyStates/CenteredStatusCard'
import { useDepositGateRemediation } from '@/features/deposit-accounts/useDepositGateRemediation'
import { gateFromEntry } from '@/utils/capability-gate'
import { accountEntry } from './report'
import { residenceAddressEntry, type ResidenceAddressEntry } from './residenceAddressEntry'
import type { FeatureReportEntry, NextAction } from '@/types/capabilities'

export function LocalResidenceAddressGate({
    currency,
    children,
    onBack,
}: {
    currency: 'ARS' | 'BRL'
    children: ReactNode
    onBack: () => void
}) {
    const { capabilities } = useCapabilities()
    const entry = capabilities.features ? accountEntry(capabilities.features, 'local', currency) : undefined
    const state = residenceAddressEntry(entry, capabilities.nextActions)
    if (!state || !entry) return <>{children}</>
    return (
        <LocalAddressStatus
            key={currency}
            currency={currency}
            entry={entry}
            state={state}
            actions={capabilities.nextActions}
            onBack={onBack}
        />
    )
}

function LocalAddressStatus({
    currency,
    entry,
    state,
    actions,
    onBack,
}: {
    currency: 'ARS' | 'BRL'
    entry: FeatureReportEntry
    state: ResidenceAddressEntry
    actions: NextAction[]
    onBack: () => void
}) {
    const t = useTranslations('depositAccounts')
    const common = useTranslations('common')
    const { user, fetchUser } = useAuth()
    const { resolveGate, modals } = useDepositGateRemediation()
    const [refresh, setRefresh] = useState(0)
    const userId = user?.user?.userId
    const waiting = state === 'in_review' || state === 'unavailable'
    useEffect(() => {
        if (!waiting) return
        let reads = 0
        let pending = false
        const timer = setInterval(async () => {
            if (pending) return
            if (++reads >= 24) clearInterval(timer)
            pending = true
            try {
                await fetchUser?.()
            } catch {
                /* Keep the last report until a successful read. */
            } finally {
                pending = false
            }
        }, 15_000)
        return () => clearInterval(timer)
    }, [userId, fetchUser, refresh, waiting])
    const prefix =
        state === 'in_review'
            ? 'addressReview'
            : state === 'rejected'
              ? 'addressRetry'
              : state === 'unavailable'
                ? 'wait'
                : 'address'
    return (
        <>
            <PageStack gap="6">
                <NavHeader title={t('list.addTitle')} onPrev={onBack} />
                <CenteredStatusCard
                    tone="neutral"
                    title={t(`gate.${prefix}Title`)}
                    description={t(`gate.${prefix}Body`, { currency })}
                >
                    <Button
                        className="w-full"
                        onClick={() => {
                            if (waiting) {
                                setRefresh((value) => value + 1)
                                void fetchUser?.().catch(() => undefined)
                            } else
                                resolveGate(
                                    gateFromEntry(entry, { rails: [], nextActions: actions }),
                                    currency === 'ARS' ? 'BANK_TRANSFER_AR' : 'PIX_BR'
                                )
                        }}
                    >
                        {waiting
                            ? common('retry')
                            : t(state === 'rejected' ? 'gate.addressRetryCta' : 'gate.addressCta')}
                    </Button>
                </CenteredStatusCard>
            </PageStack>
            {modals}
        </>
    )
}
