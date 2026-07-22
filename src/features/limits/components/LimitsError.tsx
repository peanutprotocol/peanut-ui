'use client'
import { Button } from '@/components/0_Bruddle/Button'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

export default function LimitsError() {
    const t = useTranslations('limits')
    const tCommon = useTranslations('common')
    const router = useRouter()
    return (
        <div className="px-2">
            <EmptyState title={tCommon('somethingWentWrong')} description={t('error.description')} icon="alert" />
            <div className="mt-4 flex justify-center">
                <Button icon="retry" shadowSize="4" onClick={() => router.refresh()}>
                    {tCommon('retry')}
                </Button>
            </div>
        </div>
    )
}
