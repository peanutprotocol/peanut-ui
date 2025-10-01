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
        // hide modal immediately without scheduling banner
        // afterPermissionAttempt will handle visibility re-evaluation
        hidePermissionModalImmediate()
        try {
            await requestPermission()
            await afterPermissionAttempt()
        } catch (error) {
            console.error('Error requesting permission:', error)
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
                onClose={closePermissionModal}
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
