'use client'
import { holdContextualPrompt, useNotifications } from '@/hooks/useNotifications'
import { useAuth } from '@/context/authContext'
import type { InterruptPresentation } from '@/features/attention/types'
import { AskShell } from '@/features/attention/AskShell'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'
import { motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import phoneBuddy from '@/assets/illustrations/phone-buddy.webp'
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
    [PUSH_PROMPT_TRIGGERS.FIRST_DEPOSIT]: { title: 'firstDepositTitle', description: 'firstDepositDescription' },
} as const

// one short buzz of the phone buddy (Konrad's pick, 2026-11-20) once the panel
// has entered (duration-moderate, 300 ms); the art is never redrawn, only moved
const BUZZ = { rotate: [0, -8, 8, -8, 8, -4, 0] }
const BUZZ_TRANSITION = { duration: 0.45, delay: 0.3, ease: 'easeInOut' } as const

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
    const reducedMotion = useReducedMotion()
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
                        {/* the modal mounts its content on open, so the buzz plays once per opening */}
                        <motion.div
                            className="size-40"
                            aria-hidden="true"
                            animate={reducedMotion ? undefined : BUZZ}
                            transition={BUZZ_TRANSITION}
                        >
                            <Image src={phoneBuddy} alt="" className="size-full" />
                        </motion.div>
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
