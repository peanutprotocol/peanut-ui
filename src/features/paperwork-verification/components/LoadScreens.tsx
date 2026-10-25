'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import Loading from '@/components/Global/Loading'
import { useInsetColor } from '../useInsetColor'
import { VerifyFooter, VerifyHeroLayout } from './VerifyLayout'

export function VerifyLoading() {
    useInsetColor(false)
    return (
        <div className="flex h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom))] w-full items-center justify-center bg-white">
            <Loading variant="mascot" />
        </div>
    )
}

export function LoadFailed({ onRetry, onHome }: { onRetry: () => void; onHome: () => void }) {
    const t = useTranslations('kyc.paperworkVerification')
    return (
        <VerifyHeroLayout
            pose="sad"
            title={t('loadFailed.title')}
            description={t('loadFailed.description')}
            footer={
                <VerifyFooter
                    actions={
                        <Button shadowSize="4" className="w-full" onClick={onRetry} data-testid="verify-retry-load">
                            {t('loadFailed.retry')}
                        </Button>
                    }
                    secondary={
                        <Button variant="secondary" shadowSize="4" className="w-full" onClick={onHome}>
                            {t('review.cta')}
                        </Button>
                    }
                />
            }
        />
    )
}
