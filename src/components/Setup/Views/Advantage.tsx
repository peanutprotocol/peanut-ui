'use client'

import { Button } from '@/components/0_Bruddle/Button'
import SetupFooter from '../components/SetupFooter'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useTranslations } from 'next-intl'

/** The shared wrapper supplies each benefit's copy, illustration, and progress. */
const AdvantageStep = () => {
    const t = useTranslations('setup')
    const { handleNext, isLoading, step } = useSetupFlow()
    const cta =
        step?.screenId === 'advantage-payments'
            ? 'cta.payments'
            : step?.screenId === 'advantage-rewards'
              ? 'cta.rewards'
              : step?.screenId === 'advantage-control'
                ? 'cta.control'
                : 'next'

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
                    {t(cta)}
                </Button>
            }
        />
    )
}

export default AdvantageStep
