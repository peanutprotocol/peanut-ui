'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useAccountSetup } from '@/hooks/useAccountSetup'
import { confettiPresets } from '@/utils/confetti'

export function SetupCelebrationView({ onContinue }: { onContinue: () => void }) {
    const t = useTranslations('setup')
    return (
        <Button onClick={onContinue} shadowSize="4" className="w-full">
            {t('accountReady.cta')}
        </Button>
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
