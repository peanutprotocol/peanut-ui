'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useTranslations } from 'next-intl'

/** The shared wrapper supplies each benefit's copy, illustration, and progress. */
const AdvantageStep = () => {
    const t = useTranslations('setup')
    const { handleNext, isLoading } = useSetupFlow()

    return (
        <Button size="large" className="w-full" shadowSize="4" loading={isLoading} onClick={() => handleNext()}>
            {t('next')}
        </Button>
    )
}

export default AdvantageStep
