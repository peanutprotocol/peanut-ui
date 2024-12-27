import { Button } from '@/components/0_Bruddle'
import { usePush } from '@/context/pushProvider'
import { useSetupFlow } from '@/hooks/useSetupFlow'

const NotificationPermission = () => {
    const { handleNext } = useSetupFlow()
    const { isSubscribed, subscribe, isSubscribing } = usePush()

    const handleNotificationPermission = async () => {
        if (!isSubscribed) {
            subscribe()
        } else {
            handleNext()
        }
    }

    return (
        <div className="flex flex-col gap-10">
            <div className="flex flex-row gap-2">
                <Button
                    loading={isSubscribing}
                    shadowSize={'4'}
                    disabled={isSubscribing}
                    onClick={handleNotificationPermission}
                >
                    {isSubscribed ? 'Next' : 'Enable Notification'}
                </Button>
            </div>
        </div>
    )
}

export default NotificationPermission
