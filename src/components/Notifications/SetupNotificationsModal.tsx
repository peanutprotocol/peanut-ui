'use client'
import { useNotifications } from '@/hooks/useNotifications'
import type { InterruptPresentation } from '@/features/attention/types'
import { AskShell } from '@/features/attention/AskShell'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { PeanutMascotScene } from '@/components/Global/PeanutMascot/PeanutMascotScene'
import { PUSH_PROMPT_TRIGGERS, type PushPromptTrigger } from '@/constants/push-prompt.consts'
import { notificationsApi, toPushPermission } from '@/services/notifications'
import { useSessionFence } from '@/hooks/useSessionFence'
import { useRef } from 'react'

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
    // migration-era copy ("Get money alerts") only ships when the pwa-sunset
    // flag is on — flag off keeps today's prompt byte-for-byte (TASK-20771)
    const migrationOn = useMigrationFlag()
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
            // after user interacts with native dialog, handle the result
            await afterPermissionAttempt()
            if (!session.current()) return
            // The prompt asks for money alerts, so a grant turns Important alerts on even
            // for someone who skipped them at sign-up. A failed save leaves the old choice.
            void notificationsApi
                .savePreferences(
                    { pushPermission: permission, ...(permission === 'granted' && { push: true }) },
                    session.userId ?? undefined
                )
                .catch(() => {})
        } catch (error) {
            console.error('Error requesting permission:', error)
        } finally {
            attempting.current = false
        }
    }

    const handleCloseNotifsSetupModal = (e?: React.MouseEvent) => {
        // prevent event bubbling to avoid double-triggering
        e?.preventDefault()
        e?.stopPropagation()
        // close modal and schedule banner for later
        closePermissionModal()
    }

    return (
        <SetupNotificationsPrompt
            visible={showPermissionModal}
            trigger={promptTrigger}
            onAllow={handleAllowClick}
            onClose={handleCloseNotifsSetupModal}
            isRequestingPermission={isRequestingPermission}
            migrationOn={migrationOn}
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
    migrationOn = false,
    presentation = 'modal',
}: {
    visible: boolean
    trigger?: PushPromptTrigger | null
    onAllow: (event?: React.MouseEvent) => void
    onClose: (event?: React.MouseEvent) => void
    isRequestingPermission?: boolean
    migrationOn?: boolean
    presentation?: InterruptPresentation
}) {
    const t = useTranslations('notifications')
    const momentCopy = trigger && trigger !== PUSH_PROMPT_TRIGGERS.HOME_FALLBACK ? MOMENT_COPY[trigger] : null
    return (
        <>
            <AskShell
                presentation={presentation}
                visible={visible}
                onClose={onClose}
                title={momentCopy ? t(momentCopy.title) : t(migrationOn ? 'migrationSetupTitle' : 'setupTitle')}
                description={
                    momentCopy
                        ? t(momentCopy.description)
                        : t(migrationOn ? 'migrationSetupDescription' : 'setupDescription')
                }
                body={<PeanutMascotScene scene="paper-planes" className="h-40 max-w-48" />}
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
