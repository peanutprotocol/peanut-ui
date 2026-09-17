'use client'
import { useNotifications } from '@/hooks/useNotifications'
import ActionModal from '../Global/ActionModal'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'

export default function SetupNotificationsModal() {
    // migration-era copy ("Get money alerts") only ships when the pwa-sunset
    // flag is on — flag off keeps today's prompt byte-for-byte (TASK-20771)
    const migrationOn = useMigrationFlag()
    const {
        showPermissionModal,
        requestPermission,
        closePermissionModal,
        afterPermissionAttempt,
        isRequestingPermission,
    } = useNotifications()

    const handleAllowClick = async (e?: React.MouseEvent) => {
        // prevent event bubbling to avoid double-triggering
        e?.preventDefault()
        e?.stopPropagation()

        posthog.capture(ANALYTICS_EVENTS.MODAL_CTA_CLICKED, { modal_type: MODAL_TYPES.NOTIFICATIONS, cta: 'enable' })

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
    onAllow,
    onClose,
    isRequestingPermission = false,
    migrationOn = false,
}: {
    visible: boolean
    onAllow: (event?: React.MouseEvent) => void
    onClose: (event?: React.MouseEvent) => void
    isRequestingPermission?: boolean
    migrationOn?: boolean
}) {
    const t = useTranslations('notifications')
    return (
        <>
            <ActionModal
                visible={visible}
                onClose={onClose}
                title={t(migrationOn ? 'migrationSetupTitle' : 'setupTitle')}
                description={t(migrationOn ? 'migrationSetupDescription' : 'setupDescription')}
                icon="bell"
                // stacked CTAs at every width; sm:flex-none stops ActionModal's
                // sm:flex-1 from stretching the buttons in the column
                ctaClassName="sm:flex-col"
                ctas={[
                    {
                        text: isRequestingPermission ? t('requesting') : t('enable'),
                        onClick: onAllow,
                        variant: 'purple',
                        shadowSize: '4',
                        className: 'sm:flex-none',
                        loading: isRequestingPermission,
                        disabled: isRequestingPermission,
                    },
                    {
                        text: t('notNow'),
                        onClick: onClose,
                        variant: 'stroke',
                        className: 'sm:flex-none',
                    },
                ]}
            />
        </>
    )
}
