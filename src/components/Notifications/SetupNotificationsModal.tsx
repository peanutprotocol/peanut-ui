'use client'
import { useNotifications } from '@/hooks/useNotifications'
import ActionModal from '../Global/ActionModal'

export default function SetupNotificationsModal() {
    const {
        showPermissionModal,
        requestPermission,
        closePermissionModal,
        afterPermissionAttempt,
        hidePermissionModalImmediate,
    } = useNotifications()

    const handleAllowClick = async (e?: React.MouseEvent) => {
        // prevent event bubbling to avoid double-triggering
        e?.stopPropagation()

        try {
            // request permission - this shows the native dialog
            // keep our modal open while native dialog is shown
            await requestPermission()

            // after user interacts with native dialog, handle the result
            // this will close our modal and schedule banner if needed
            hidePermissionModalImmediate()
            await afterPermissionAttempt()
        } catch (error) {
            console.error('Error requesting permission:', error)
            // ensure modal is closed even on error
            hidePermissionModalImmediate()
        }
    }

    const handleNotNowClick = (e?: React.MouseEvent) => {
        // prevent event bubbling to avoid double-triggering
        e?.stopPropagation()
        // close modal and schedule banner for later
        closePermissionModal()
    }

    return (
        <>
            <ActionModal
                visible={showPermissionModal}
                onClose={handleNotNowClick}
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
                        onClick: handleNotNowClick,
                        variant: 'transparent',
                        className: 'underline h-6',
                    },
                ]}
            />
        </>
    )
}
