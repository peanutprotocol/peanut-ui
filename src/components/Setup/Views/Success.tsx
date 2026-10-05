'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import SetupFooter from '../components/SetupFooter'
import { MiniHeader } from '@/components/0_Bruddle/MiniHeader'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useAccountSetup } from '@/hooks/useAccountSetup'
import { confettiPresets } from '@/utils/confetti'

/** Full-page celebration with centered content and the shared mascot/confetti. */
export function SetupCelebrationView({ onContinue }: { onContinue: () => void }) {
    const t = useTranslations('setup')
    return (
        <PageStack className="flex-1" data-setup-celebration>
            <PageStack.Center className="items-center text-center">
                <PeanutMascot pose="cheering" alt="" className="h-52 w-auto" />
                <TitleBlock
                    align="center"
                    size="s"
                    title={<h1>{t('steps.success.title')}</h1>}
                    description={t('steps.success.description')}
                />
                <div className="flex w-full flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <MiniHeader>{t('accountReady.worksNowTitle')}</MiniHeader>
                        <p className="text-body-s">{t('accountReady.worksNowBody')}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                        <MiniHeader>{t('accountReady.laterTitle')}</MiniHeader>
                        <p className="text-body-s">{t('accountReady.laterBody')}</p>
                    </div>
                </div>
            </PageStack.Center>
            <SetupFooter
                actions={
                    <Button onClick={onContinue} className="w-full">
                        {t('accountReady.cta')}
                    </Button>
                }
            />
        </PageStack>
    )
}

export default function SuccessStep() {
    const { signupCompleted } = useSetupFlowContext()
    const { handleRedirect } = useAccountSetup()
    const celebrated = useRef(false)
    const redirecting = useRef(false)
    useEffect(() => {
        if (!signupCompleted || celebrated.current) return
        celebrated.current = true
        confettiPresets.celebration()
    }, [signupCompleted])
    if (!signupCompleted) return null
    return (
        <SetupCelebrationView
            onContinue={() => {
                if (redirecting.current) return
                redirecting.current = true
                handleRedirect({ isNewAccount: true })
            }}
        />
    )
}
