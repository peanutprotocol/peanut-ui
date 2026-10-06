'use client'
import { useNotifications } from '@/hooks/useNotifications'
import ActionModal from '../Global/ActionModal'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { PUSH_PROMPT_TRIGGERS, type PushPromptTrigger } from '@/constants/push-prompt.consts'

// each money moment promises what the push will be about (TASK-23251); the
// Home fallback keeps the original ask
const MOMENT_COPY = {
    [PUSH_PROMPT_TRIGGERS.DEPOSIT_INTENT]: { title: 'depositIntentTitle', description: 'depositIntentDescription' },
    [PUSH_PROMPT_TRIGGERS.REQUEST_CREATED]: { title: 'requestCreatedTitle', description: 'requestCreatedDescription' },
    [PUSH_PROMPT_TRIGGERS.CARD_READY]: { title: 'cardReadyTitle', description: 'cardReadyDescription' },
    [PUSH_PROMPT_TRIGGERS.QR_FIRST_SCAN]: { title: 'qrFirstScanTitle', description: 'qrFirstScanDescription' },
} as const

export default function SetupNotificationsModal() {
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

        posthog.capture(ANALYTICS_EVENTS.MODAL_CTA_CLICKED, {
            modal_type: MODAL_TYPES.NOTIFICATIONS,
            cta: 'enable',
            trigger: promptTrigger,
        })

        try {
            // request permission - this shows the native dialog
            await requestPermission()
            // after user interacts with native dialog, handle the result
            await afterPermissionAttempt()
        } catch (error) {
            console.error('Error requesting permission:', error)
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
}: {
    visible: boolean
    trigger?: PushPromptTrigger | null
    onAllow: (event?: React.MouseEvent) => void
    onClose: (event?: React.MouseEvent) => void
    isRequestingPermission?: boolean
    migrationOn?: boolean
}) {
    const t = useTranslations('notifications')
    const momentCopy = trigger && trigger !== PUSH_PROMPT_TRIGGERS.HOME_FALLBACK ? MOMENT_COPY[trigger] : null
    return (
        <>
            <ActionModal
                visible={visible}
                onClose={onClose}
                title={momentCopy ? t(momentCopy.title) : t(migrationOn ? 'migrationSetupTitle' : 'setupTitle')}
                description={
                    momentCopy
                        ? t(momentCopy.description)
                        : t(migrationOn ? 'migrationSetupDescription' : 'setupDescription')
                }
                tone="peanut"
                icon="bell"
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
