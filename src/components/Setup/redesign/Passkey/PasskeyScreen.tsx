'use client'

import { useTranslations } from 'next-intl'
import PasskeyStep from '@/components/Setup/Views/Passkey'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'

/**
 * 03 Passkey (step `passkey`). PLACEHOLDER from the foundation: the mock's ground, stage and headline on the new shell, with
 * dev's view as the panel body so the flow keeps working. Package C replaces this file's body; keep the name
 * and the props. Contract: mono _temp/signup-redesign/r2/r9/build/INTERFACES.md.
 */
export function PasskeyScreen(_props: StepComponentProps) {
    const t = useTranslations('setupRedesign.passkey.s1')
    return (
        <SetupScreen
            ground="pink"
            stage="std"
            title={t('title')}
            footer={null}
            state="default"
            panelClassName="overflow-y-auto pb-6"
        >
            <PasskeyStep />
        </SetupScreen>
    )
}
