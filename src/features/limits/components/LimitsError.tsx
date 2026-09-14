'use client'
import { Button } from '@/components/0_Bruddle/Button'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
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
        <div className="px-2">
            <EmptyState title={tCommon('somethingWentWrong')} description={t('error.description')} icon="alert" />
            <div className="mt-4 flex justify-center">
                <Button icon="retry" shadowSize="4" onClick={onRetry} loading={isRetrying} disabled={isRetrying}>
                    {tCommon('retry')}
                </Button>
            </div>
        </div>
    )
}
