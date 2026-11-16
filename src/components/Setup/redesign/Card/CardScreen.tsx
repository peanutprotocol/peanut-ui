'use client'

import { useTranslations } from 'next-intl'
import AdvantageStep from '@/components/Setup/Views/Advantage'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'

/**
 * 06 Card (step `advantage-card`). PLACEHOLDER from the foundation: the mock's ground, stage and headline on the new shell, with
 * dev's view as the panel body so the flow keeps working. Package P3 replaces this file's body; keep the name
 * and the props. Contract: mono _temp/signup-redesign/r2/r9/build/INTERFACES.md.
 */
export function CardScreen(_props: StepComponentProps) {
    const t = useTranslations('setupRedesign.card')
    return (
        <SetupScreen
            ground="sky"
            stage="tall"
            title={t('title')}
            footer={null}
            state="default"
            panelClassName="overflow-y-auto pb-6"
        >
            <AdvantageStep />
        </SetupScreen>
    )
}
