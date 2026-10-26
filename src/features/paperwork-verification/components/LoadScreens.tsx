'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { StepsScreen } from './StatusScreens'
import { VerifyFooter, VerifyHeroLayout } from './VerifyLayout'

/** Every load in this flow opens on the steps overview, so its skeleton stands in: never a loading mascot. */
export function VerifyLoading({ onBack }: { onBack: () => void }) {
    return <StepsScreen loading onBack={onBack} />
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
