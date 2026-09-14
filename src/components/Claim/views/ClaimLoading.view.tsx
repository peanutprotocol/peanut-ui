'use client'
import Loading from '@/components/Global/Loading'
import { useTranslations } from 'next-intl'

interface ClaimLoadingViewProps {
    isSendLinkLoading: boolean
    failureCount: number
}

// loading state of the claim page — markup moved verbatim from Claim.tsx
export const ClaimLoadingView = ({ isSendLinkLoading, failureCount }: ClaimLoadingViewProps) => {
    const t = useTranslations('claim')
    return (
        <div className="flex flex-col items-center gap-4 px-4">
            <Loading variant="mascot" />
            {isSendLinkLoading && failureCount > 0 && (
                <p className="text-center text-body-s text-foreground-secondary">
                    {failureCount < 3 ? t('loading.loadingYourLink') : t('loading.takingLonger')}
                </p>
            )}
            {isSendLinkLoading && failureCount >= 3 && (
                <p className="text-center text-body-xs text-foreground-secondary">
                    {t('loading.stillTrying', { attempt: failureCount + 1, total: 5 })}
                </p>
            )}
        </div>
    )
}
