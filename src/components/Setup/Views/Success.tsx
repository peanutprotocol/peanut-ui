'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { MiniHeader } from '@/components/0_Bruddle/MiniHeader'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useAccountSetup } from '@/hooks/useAccountSetup'
import { confettiPresets } from '@/utils/confetti'

/** The same centered mascot, success card and footer recipe used by payment/account success. */
export function SetupCelebrationView({ onContinue }: { onContinue: () => void }) {
    const t = useTranslations('setup')
    return (
        <PageStack className="flex-1" data-setup-celebration>
            <PageStack.Center className="items-center">
                <PeanutMascot pose="cheering" alt="" className="h-52 w-auto" />
                <Card className="flex w-full flex-col gap-4 p-4">
                    <div className="flex items-center gap-3">
                        <IconBubble icon="check" color="green" />
                        <TitleBlock
                            size="s"
                            title={<h1>{t('steps.success.title')}</h1>}
                            description={t('steps.success.description')}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <MiniHeader>{t('accountReady.worksNowTitle')}</MiniHeader>
                        <p className="text-body-s">{t('accountReady.worksNowBody')}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                        <MiniHeader>{t('accountReady.laterTitle')}</MiniHeader>
                        <p className="text-body-s">{t('accountReady.laterBody')}</p>
                    </div>
                </Card>
            </PageStack.Center>
            <PageStack.Footer>
                <Button onClick={onContinue} className="w-full">
                    {t('accountReady.cta')}
                </Button>
            </PageStack.Footer>
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
