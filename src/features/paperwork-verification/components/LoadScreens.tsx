'use client'

import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
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

export function VerificationOutage({ onBack }: { onBack: () => void }) {
    const t = useTranslations('kyc')
    return (
        <div data-testid="verify-outage">
            <VerifyHeroLayout
                pose="sad"
                onBack={onBack}
                title={t('degraded.title')}
                description={t('degraded.description')}
                footer={
                    <VerifyFooter
                        actions={
                            <Button
                                className="w-full"
                                onClick={() => {
                                    posthog.capture(ANALYTICS_EVENTS.KYC_DEGRADED_NOTIFY_REQUESTED)
                                    posthog.setPersonProperties({ kyc_down_notify_requested: true })
                                    onBack()
                                }}
                            >
                                {t('degraded.notifyMe')}
                            </Button>
                        }
                    />
                }
            />
        </div>
    )
}
