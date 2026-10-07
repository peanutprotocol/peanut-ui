'use client'

import { useTranslations } from 'next-intl'
import NavHeader from '@/components/Global/NavHeader'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'

export function ClosedCollectionView({ isCrowdfunding, onBack }: { isCrowdfunding: boolean; onBack: () => void }) {
    const tPots = useTranslations('pots')
    const t = useTranslations('payment')
    return (
        <div className="flex min-h-inherit flex-col gap-4">
            <NavHeader title={isCrowdfunding ? tPots('title') : t('headers.pay')} onPrev={onBack} />
            <EmptyState icon="lock" title={tPots('closed')} description={tPots('closedDescription')} />
        </div>
    )
}
