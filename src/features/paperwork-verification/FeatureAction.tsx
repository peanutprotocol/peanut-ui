'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { VerifyFooter, VerifyHeroLayout } from './components/VerifyLayout'

export function FeatureAction({ action, onBack, onDone }: { action: string; onBack: () => void; onDone: () => void }) {
    const t = useTranslations('kyc.paperworkVerification')
    const flow = useSumsubKycFlow({ onKycSuccess: onDone })
    const started = useRef(false)
    useEffect(() => {
        if (started.current) return
        started.current = true
        void flow.handleStartAction(action)
    }, [action, flow])
    return (
        <>
            <VerifyHeroLayout
                pose="thinking"
                onBack={onBack}
                title={t('addLater.actionTitle')}
                description={flow.error ?? t('addLater.actionDescription')}
                footer={
                    <VerifyFooter
                        actions={
                            <Button
                                className="w-full"
                                loading={flow.isLoading}
                                disabled={flow.isLoading}
                                onClick={() => void flow.handleStartAction(action)}
                            >
                                {t('continue')}
                            </Button>
                        }
                    />
                }
            />
            <SumsubKycWrapper
                visible={flow.showWrapper}
                accessToken={flow.accessToken}
                onClose={flow.handleClose}
                onComplete={() => {
                    flow.handleSdkComplete()
                    onDone()
                }}
                onRefreshToken={flow.refreshToken}
            />
        </>
    )
}
