'use client'

import { Button } from '@/components/0_Bruddle/Button'
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
              : 'cta.control'

    return (
        <Button size="large" className="w-full" shadowSize="4" loading={isLoading} onClick={() => handleNext()}>
            {t(cta)}
        </Button>
    )
}

export default AdvantageStep
