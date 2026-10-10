'use client'

import { Button } from '@/components/0_Bruddle/Button'
import SetupFooter from '../components/SetupFooter'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useTranslations } from 'next-intl'

/** The shared wrapper supplies each sell screen's copy and illustration. */
const AdvantageStep = () => {
    const t = useTranslations('setup')
    const { handleNext, isLoading } = useSetupFlow()

    return (
        <SetupFooter
            actions={
                <Button
                    size="medium"
                    className="w-full"
                    shadowSize="4"
                    loading={isLoading}
                    onClick={() => handleNext()}
                >
                    {t('cta.continue')}
                </Button>
            }
        />
    )
}

export default AdvantageStep
