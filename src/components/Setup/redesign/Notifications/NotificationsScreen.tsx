'use client'

import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { NotificationsControlScreen } from './NotificationsControlScreen'

/** 10 Notifications (step `notification-permission`). Contract P4 § 3. */
export function NotificationsScreen(_props: StepComponentProps) {
    return <NotificationsControlScreen />
}
