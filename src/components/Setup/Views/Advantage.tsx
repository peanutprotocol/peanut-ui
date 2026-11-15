'use client'

import { Button } from '@/components/0_Bruddle/Button'
import SetupFooter from '../components/SetupFooter'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { useTranslations } from 'next-intl'

/** The shared wrapper supplies each sell screen's copy and illustration. */
const AdvantageStep = () => {
    const t = useTranslations('setup')
    const { handleNext, isLoading } = useSetupFlow()
    const { track } = useSignupControl()

    return (
        <SetupFooter
            actions={
                <Button
                    size="medium"
                    className="w-full"
                    shadowSize="4"
                    loading={isLoading}
                    onClick={() => {
                        track('continue', 'tap')
                        void handleNext()
                    }}
                >
                    {t('cta.continue')}
                </Button>
            }
        />
    )
}

export default AdvantageStep
