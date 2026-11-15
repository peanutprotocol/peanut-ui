'use client'
import { holdContextualPrompt, useNotifications } from '@/hooks/useNotifications'
import { useAuth } from '@/context/authContext'
import type { InterruptPresentation } from '@/features/attention/types'
import { AskShell } from '@/features/attention/AskShell'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'
import { PeanutMascotScene } from '@/components/Global/PeanutMascot/PeanutMascotScene'
import { PUSH_PROMPT_TRIGGERS, type PushPromptTrigger } from '@/constants/push-prompt.consts'
import { notificationsApi, toPushPermission } from '@/services/notifications'
import { useSessionFence } from '@/hooks/useSessionFence'
import { useRef, useState } from 'react'

// each money moment promises what the push will be about (TASK-23251); the
// Home fallback keeps the original ask
const MOMENT_COPY = {
    [PUSH_PROMPT_TRIGGERS.DEPOSIT_INTENT]: { title: 'depositIntentTitle', description: 'depositIntentDescription' },
    [PUSH_PROMPT_TRIGGERS.REQUEST_CREATED]: { title: 'requestCreatedTitle', description: 'requestCreatedDescription' },
    [PUSH_PROMPT_TRIGGERS.CARD_READY]: { title: 'cardReadyTitle', description: 'cardReadyDescription' },
    [PUSH_PROMPT_TRIGGERS.QR_FIRST_SCAN]: { title: 'qrFirstScanTitle', description: 'qrFirstScanDescription' },
} as const

export default function SetupNotificationsModal() {
    const captureSession = useSessionFence()
    const attempting = useRef(false)
    const userId = useAuth().user?.user.userId
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState(false)
    const tCommon = useTranslations('common')
    const {
        showPermissionModal,
        promptTrigger,
        requestPermission,
        closePermissionModal,
        afterPermissionAttempt,
        isRequestingPermission,
    } = useNotifications()

    const handleAllowClick = async (e?: React.MouseEvent) => {
        // prevent event bubbling to avoid double-triggering
        e?.preventDefault()
        e?.stopPropagation()
        if (attempting.current) return
        attempting.current = true
        const session = captureSession()
        holdContextualPrompt(true)
        setSaving(true)
        setSaveError(false)
        try {
            if (session.ready) await session.ready
            if (!session.current()) return
            posthog.capture(ANALYTICS_EVENTS.MODAL_CTA_CLICKED, {
                modal_type: MODAL_TYPES.NOTIFICATIONS,
                cta: 'enable',
                trigger: promptTrigger,
            })
            // request permission - this shows the native dialog
            const permission = toPushPermission(await requestPermission())
            if (!session.current()) return
            if (permission === 'granted') {
                if (!userId) throw new Error('Missing account')
                await notificationsApi.savePreferences({ pushPermission: permission, push: true }, userId)
                if (!session.current()) return
            }
            await afterPermissionAttempt()
            if (session.current()) holdContextualPrompt(false)
        } catch {
            if (session.current()) setSaveError(true)
        } finally {
            attempting.current = false
            if (session.current()) setSaving(false)
        }
    }

    const handleCloseNotifsSetupModal = (e?: React.MouseEvent) => {
        // prevent event bubbling to avoid double-triggering
        e?.preventDefault()
        e?.stopPropagation()
        // close modal and schedule banner for later
        closePermissionModal()
        holdContextualPrompt(false)
    }

    return (
        <SetupNotificationsPrompt
            visible={showPermissionModal}
            trigger={promptTrigger}
            onAllow={handleAllowClick}
            onClose={handleCloseNotifsSetupModal}
            isRequestingPermission={isRequestingPermission || saving}
            error={saveError ? tCommon('somethingWentWrong') : undefined}
        />
    )
}

/** Presentational prompt, shared with the deterministic screen catalogue. */
export function SetupNotificationsPrompt({
    visible,
    trigger = null,
    onAllow,
    onClose,
    isRequestingPermission = false,
    presentation = 'modal',
    error,
}: {
    visible: boolean
    trigger?: PushPromptTrigger | null
    onAllow: (event?: React.MouseEvent) => void
    onClose: (event?: React.MouseEvent) => void
    isRequestingPermission?: boolean
    presentation?: InterruptPresentation
    error?: string
}) {
    const t = useTranslations('notifications')
    const momentCopy = trigger && trigger !== PUSH_PROMPT_TRIGGERS.HOME_FALLBACK ? MOMENT_COPY[trigger] : null
    return (
        <>
            <AskShell
                presentation={presentation}
                visible={visible}
                onClose={onClose}
                title={momentCopy ? t(momentCopy.title) : t('migrationSetupTitle')}
                description={momentCopy ? t(momentCopy.description) : t('migrationSetupDescription')}
                body={
                    <>
                        <PeanutMascotScene scene="paper-planes" className="h-40 max-w-48" />
                        {error && <p role="alert">{error}</p>}
                    </>
                }
                // stacked CTAs at every width; sm:flex-none stops ActionModal's
                // sm:flex-1 from stretching the buttons in the column
                ctaClassName="sm:flex-col"
                ctas={[
                    {
                        text: isRequestingPermission ? t('requesting') : t('enable'),
                        onClick: onAllow,
                        variant: 'primary',
                        shadowSize: '4',
                        className: 'sm:flex-none',
                        loading: isRequestingPermission,
                        disabled: isRequestingPermission,
                    },
                ]}
                tertiaryCta={{ text: t('notNow'), onClick: onClose }}
            />
        </>
    )
}
