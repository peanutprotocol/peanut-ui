'use client'
import { useNotifications } from '@/hooks/useNotifications'
import ActionModal from '../Global/ActionModal'

export default function SetupNotificationsModal() {
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
                title="Turn on notifications?"
                description="Enable notifications and get alerts for all wallet activity."
                icon="bell"
                ctaClassName="md:flex-col gap-4"
                ctas={[
                    {
                        text: isRequestingPermission ? 'Requesting...' : 'Enable notifications',
                        onClick: handleAllowClick,
                        variant: 'purple',
                        shadowSize: '4',
                        className: 'py-2.5',
                        loading: isRequestingPermission,
                        disabled: isRequestingPermission,
                    },
                    {
                        text: 'Not now',
                        onClick: handleCloseNotifsSetupModal,
                        variant: 'transparent',
                        className: 'underline h-6',
                    },
                ]}
            />
        </>
    )
}
