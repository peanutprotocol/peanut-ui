'use client'

import { useTranslations } from 'next-intl'
import EmailStep from '@/components/Setup/Views/Email'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'

/**
 * 09 Email (step `notification-email`). PLACEHOLDER from the foundation: the mock's ground, stage and headline on the new shell, with
 * dev's view as the panel body so the flow keeps working. Package P4 replaces this file's body; keep the name
 * and the props. Contract: mono _temp/signup-redesign/r2/r9/build/INTERFACES.md.
 */
export function EmailScreen(_props: StepComponentProps) {
    const t = useTranslations('setupRedesign.email')
    return (
        <SetupScreen
            ground="yellow"
            stage="std"
            title={t('title')}
            footer={null}
            state="default"
            panelClassName="overflow-y-auto pb-6"
        >
            <EmailStep />
        </SetupScreen>
    )
}
