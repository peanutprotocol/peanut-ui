'use client'
import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import CenteredStatusCard from '@/components/Global/EmptyStates/CenteredStatusCard'
import { useTranslations } from 'next-intl'

interface LimitsErrorProps {
    /** re-runs the limits query. router.refresh() never refetched react-query. */
    onRetry: () => void
    isRetrying?: boolean
}

export default function LimitsError({ onRetry, isRetrying }: LimitsErrorProps) {
    const t = useTranslations('limits')
    const tCommon = useTranslations('common')
    return (
        <PageStack.Center className="gap-4">
            <CenteredStatusCard title={t('error.title')} description={t('error.description')} />
            <Button icon="retry" shadowSize="4" onClick={onRetry} loading={isRetrying} disabled={isRetrying}>
                {tCommon('retry')}
            </Button>
        </PageStack.Center>
    )
}
