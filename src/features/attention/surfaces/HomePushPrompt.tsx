'use client'

import { useEffect } from 'react'
import { SetupNotificationsPrompt } from '@/components/Notifications/SetupNotificationsModal'
import { PUSH_PROMPT_TRIGGERS } from '@/constants/push-prompt.consts'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { useNotifications, markPushPromptShownThisSession } from '@/hooks/useNotifications'
import type { AskSurfaceProps } from '../types'

/** The context-free Home push ask, for users no money moment has reached. */
export default function HomePushPrompt({ onActed, onSnoozed, presentation }: AskSurfaceProps) {
    const migrationOn = useMigrationFlag()
    const { requestPermission, afterPermissionAttempt, isRequestingPermission } = useNotifications()
    useEffect(() => {
        markPushPromptShownThisSession(PUSH_PROMPT_TRIGGERS.HOME_FALLBACK)
    }, [])

    const allow = async (e?: React.MouseEvent) => {
        e?.preventDefault()
        e?.stopPropagation()
        try {
            const result = await requestPermission(PUSH_PROMPT_TRIGGERS.HOME_FALLBACK)
            await afterPermissionAttempt()
            if (result === 'granted') onActed()
            else onSnoozed()
        } catch (error) {
            console.error('Error requesting permission:', error)
            onSnoozed()
        }
    }

    return (
        <SetupNotificationsPrompt
            presentation={presentation}
            visible
            trigger={PUSH_PROMPT_TRIGGERS.HOME_FALLBACK}
            onAllow={allow}
            onClose={(e?: React.MouseEvent) => {
                e?.preventDefault()
                e?.stopPropagation()
                onSnoozed()
            }}
            isRequestingPermission={isRequestingPermission}
            migrationOn={migrationOn}
        />
    )
}
