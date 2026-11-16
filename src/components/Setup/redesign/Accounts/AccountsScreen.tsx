'use client'

import { useTranslations } from 'next-intl'
import AdvantageStep from '@/components/Setup/Views/Advantage'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'

/**
 * 05 Accounts (step `advantage-fees`). PLACEHOLDER from the foundation: the mock's ground, stage and headline on the new shell, with
 * dev's view as the panel body so the flow keeps working. Package P3 replaces this file's body; keep the name
 * and the props. Contract: mono _temp/signup-redesign/r2/r9/build/INTERFACES.md.
 */
export function AccountsScreen(_props: StepComponentProps) {
    const t = useTranslations('setupRedesign.accounts')
    return (
        <SetupScreen
            ground="yellow"
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
