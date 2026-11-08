'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSessionFence } from '@/hooks/useSessionFence'
import { notificationsApi } from '@/services/notifications'
import { useAttention } from '../AttentionProvider'
import { SetupNotificationsPrompt } from '@/components/Notifications/SetupNotificationsModal'
import { PUSH_PROMPT_TRIGGERS } from '@/constants/push-prompt.consts'
import { useNotifications, markPushPromptShownThisSession } from '@/hooks/useNotifications'
import type { AskSurfaceProps } from '../types'

/** The context-free Home push ask, for users no money moment has reached. */
export default function HomePushPrompt({ onActed, onSnoozed, presentation }: AskSurfaceProps) {
    const { holdPushPrompt, state } = useAttention()
    const captureSession = useSessionFence()
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState(false)
    const attempting = useRef(false)
    const tCommon = useTranslations('common')
    const { requestPermission, afterPermissionAttempt, isRequestingPermission } = useNotifications()
    useEffect(() => {
        markPushPromptShownThisSession(PUSH_PROMPT_TRIGGERS.HOME_FALLBACK)
    }, [])

    const allow = async (e?: React.MouseEvent) => {
        e?.preventDefault()
        e?.stopPropagation()
        if (attempting.current) return
        attempting.current = true
        const session = captureSession()
        if (!session.current()) {
            attempting.current = false
            return
        }
        holdPushPrompt(true)
        setSaving(true)
        setSaveError(false)
        try {
            if (session.ready) await session.ready
            if (!session.current()) return
            const result = await requestPermission(PUSH_PROMPT_TRIGGERS.HOME_FALLBACK)
            if (!session.current()) return
            if (result === 'granted') {
                if (!state.userId) throw new Error('Missing account')
                await notificationsApi.savePreferences({ pushPermission: 'granted', push: true }, state.userId)
                if (!session.current()) return
                await afterPermissionAttempt()
                if (!session.current()) return
                onActed()
            } else {
                await afterPermissionAttempt()
                if (!session.current()) return
                onSnoozed()
            }
            holdPushPrompt(false)
        } catch {
            if (session.current()) setSaveError(true)
        } finally {
            attempting.current = false
            if (session.current()) setSaving(false)
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
                holdPushPrompt(false)
            }}
            isRequestingPermission={isRequestingPermission || saving}
            error={saveError ? tCommon('somethingWentWrong') : undefined}
        />
    )
}
