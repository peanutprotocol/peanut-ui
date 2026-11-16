'use client'

import { useState } from 'react'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { readNotificationsVariant } from '@/features/setup/notificationsExperiment'
import { NotificationsControlScreen } from './NotificationsControlScreen'
import { NotificationsSwitchesScreen } from './NotificationsSwitchesScreen'

/**
 * 10 Notifications (step `notification-permission`). The `signup-notification-switches` experiment picks the
 * panel and footer; the arm is read once on mount, so the screen never changes under the user. Contract P4 § 3.
 */
export function NotificationsScreen(_props: StepComponentProps) {
    const [variant] = useState(readNotificationsVariant)
    return variant === 'control' ? <NotificationsControlScreen /> : <NotificationsSwitchesScreen variant={variant} />
}
