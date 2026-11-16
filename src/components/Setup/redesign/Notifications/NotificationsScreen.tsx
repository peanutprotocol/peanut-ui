'use client'

import NotificationsStep from '@/components/Setup/Views/Notifications'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'

/**
 * 10 Notifications (step `notification-permission`). PLACEHOLDER from the foundation: the mock's ground, stage on the new shell, with
 * dev's view as the panel body so the flow keeps working. Package P4 replaces this file's body; keep the name
 * and the props. Contract: mono _temp/signup-redesign/r2/r9/build/INTERFACES.md.
 */
export function NotificationsScreen(_props: StepComponentProps) {
    return (
        <SetupScreen ground="pink" stage="std" footer={null} state="default" panelClassName="overflow-y-auto pb-6">
            <NotificationsStep />
        </SetupScreen>
    )
}
