'use client'

import { useTranslations } from 'next-intl'
import InviteStep from '@/components/Setup/Views/Invite'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'

/**
 * 04 Invite (step `invite`). PLACEHOLDER from the foundation: the mock's ground, stage and headline on the new shell, with
 * dev's view as the panel body so the flow keeps working. Package P2 replaces this file's body; keep the name
 * and the props. Contract: mono _temp/signup-redesign/r2/r9/build/INTERFACES.md.
 */
export function InviteScreen(_props: StepComponentProps) {
    const t = useTranslations('setupRedesign.invite')
    return (
        <SetupScreen
            ground="sky"
            stage="std"
            title={t('title')}
            footer={null}
            state="default"
            panelClassName="overflow-y-auto pb-6"
        >
            <InviteStep />
        </SetupScreen>
    )
}
