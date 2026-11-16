'use client'

import { useTranslations } from 'next-intl'
import SignupStep from '@/components/Setup/Views/Signup'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'

/**
 * 02 Username (step `signup`). PLACEHOLDER from the foundation: the mock's ground, stage and headline on the new shell, with
 * dev's view as the panel body so the flow keeps working. Package C replaces this file's body; keep the name
 * and the props. Contract: mono _temp/signup-redesign/r2/r9/build/INTERFACES.md.
 */
export function UsernameScreen(_props: StepComponentProps) {
    const t = useTranslations('setupRedesign.username')
    return (
        <SetupScreen
            ground="yellow"
            stage="std"
            title={t('title')}
            footer={null}
            state="default"
            panelClassName="overflow-y-auto pb-6"
        >
            <SignupStep />
        </SetupScreen>
    )
}
