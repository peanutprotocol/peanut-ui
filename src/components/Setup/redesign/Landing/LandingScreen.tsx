'use client'

import { useTranslations } from 'next-intl'
import LandingStep from '@/components/Setup/Views/Landing'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'

/**
 * 01 Landing (step `landing`). PLACEHOLDER from the foundation: the mock's ground, stage and headline on the new shell, with
 * dev's view as the panel body so the flow keeps working. Package P1 replaces this file's body; keep the name
 * and the props. Contract: mono _temp/signup-redesign/r2/r9/build/INTERFACES.md.
 */
export function LandingScreen(_props: StepComponentProps) {
    const t = useTranslations('setupRedesign.landing')
    return (
        <SetupScreen
            ground="sky"
            stage="tall"
            title={t('title')}
            titleSize="l"
            chrome={{ back: false, dots: false }}
            footer={null}
            state="default"
            panelClassName="overflow-y-auto pb-6"
        >
            <LandingStep />
        </SetupScreen>
    )
}
