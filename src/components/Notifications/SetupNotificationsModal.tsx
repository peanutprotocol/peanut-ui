'use client'
import { useNotifications } from '@/hooks/useNotifications'
import ActionModal from '../Global/ActionModal'

export default function SetupNotificationsModal() {
    const { showPermissionModal, requestPermission, closePermissionModal, afterPermissionAttempt } = useNotifications()

    const handleModalClose = () => {
        closePermissionModal()
    }

    const handleAllowClick = async () => {
        try {
            await requestPermission()
            await afterPermissionAttempt()
        } finally {
            // always close, even if requestPermission throws or user cancels
            closePermissionModal()
        }
    }

    return (
        <>
            <ActionModal
                visible={showPermissionModal}
                onClose={handleModalClose}
                modalPanelClassName="m-0 max-w-[90%]"
                title="Turn on notifications?"
                description="Enable notifications and get alerts for all wallet activity."
                icon="bell"
                ctaClassName="md:flex-col gap-4"
                ctas={[
                    {
                        text: 'Enable notifications',
                        onClick: handleAllowClick,
                        variant: 'purple',
                        shadowSize: '4',
                        className: 'py-2.5',
                    },
                    {
                        text: 'Not now',
                        onClick: handleModalClose,
                        variant: 'transparent',
                        className: 'underline h-6',
                    },
                ]}
            />
        </>
    )
}
