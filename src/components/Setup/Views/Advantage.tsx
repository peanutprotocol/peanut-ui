'use client'

import { Button } from '@/components/0_Bruddle/Button'
import SetupFooter from '../components/SetupFooter'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useTranslations } from 'next-intl'
import type { ScreenId } from '../Setup.types'

const CTA_BY_SCREEN = {
    'advantage-payments': 'cta.payments',
    'advantage-rewards': 'cta.rewards',
    'advantage-control': 'cta.control',
    'advantage-fees': 'cta.fees',
    'advantage-bank': 'cta.bank',
    'advantage-card': 'cta.card',
    'advantage-exchange': 'cta.exchange',
    'advantage-local': 'cta.local',
    'advantage-people': 'cta.people',
} as const satisfies Partial<Record<ScreenId, string>>

/** The shared wrapper supplies each benefit's copy, illustration, and progress. */
const AdvantageStep = () => {
    const t = useTranslations('setup')
    const { handleNext, isLoading, step } = useSetupFlow()
    const cta =
        step && step.screenId in CTA_BY_SCREEN ? CTA_BY_SCREEN[step.screenId as keyof typeof CTA_BY_SCREEN] : 'next'

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
