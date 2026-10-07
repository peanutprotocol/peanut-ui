'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useAccountSetup } from '@/hooks/useAccountSetup'
import { notifyHaptic } from '@/utils/haptics'
import CelebrationCurtain from '../components/CelebrationCurtain'

/** Full-page celebration with centered content and the shared mascot/confetti. */
export function SetupCelebrationView() {
    const t = useTranslations('setup')
    return (
        <PageStack className="flex-1" data-setup-celebration>
            <CelebrationCurtain />
            <PageStack.Center className="relative z-10 items-center text-center">
                <PeanutMascot pose="cheering" alt="" className="h-52 w-auto" />
                <TitleBlock align="center" size="s" title={<h1>{t('steps.success.title')}</h1>}>
                    <p className="text-body-m leading-[1.625rem] text-foreground-secondary">
                        {t('steps.success.description')}
                    </p>
                </TitleBlock>
            </PageStack.Center>
        </PageStack>
    )
}

export default function SuccessStep() {
    const { signupCompleted } = useSetupFlowContext()
    const { handleRedirect } = useAccountSetup()
    const redirect = useRef(handleRedirect)
    redirect.current = handleRedirect
    const celebrated = useRef(false)
    const redirecting = useRef(false)
    useEffect(() => {
        if (!signupCompleted) return
        if (!celebrated.current) {
            celebrated.current = true
            notifyHaptic('success')
        }
        const timer = setTimeout(() => {
            if (redirecting.current) return
            redirecting.current = true
            redirect.current({ isNewAccount: true })
        }, 4500)
        return () => clearTimeout(timer)
    }, [signupCompleted])
    if (!signupCompleted) return null
    return <SetupCelebrationView />
}
