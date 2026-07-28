'use client'
import { useNotifications } from '@/hooks/useNotifications'
import ActionModal from '../Global/ActionModal'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'

export default function SetupNotificationsModal() {
    const t = useTranslations('notifications')
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
        <>
            <ActionModal
                visible={showPermissionModal}
                onClose={handleCloseNotifsSetupModal}
                modalPanelClassName="m-0 max-w-[90%]"
                title={t('setupTitle')}
                description={t('setupDescription')}
                icon="bell"
                ctaClassName="md:flex-col gap-4"
                ctas={[
                    {
                        text: isRequestingPermission ? t('requesting') : t('enable'),
                        onClick: handleAllowClick,
                        variant: 'purple',
                        shadowSize: '4',
                        className: 'py-2.5',
                        loading: isRequestingPermission,
                        disabled: isRequestingPermission,
                    },
                    {
                        text: t('notNow'),
                        onClick: handleCloseNotifsSetupModal,
                        variant: 'transparent',
                        className: 'underline h-6',
                    },
                ]}
            />
        </>
    )
}
