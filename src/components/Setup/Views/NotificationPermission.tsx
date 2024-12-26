import { Button } from '@/components/0_Bruddle'
import { usePush } from '@/context/pushProvider'

const NotificationPermission = () => {
    const { isSubscribed, subscribe, isSubscribing, send } = usePush()

    return (
        <div className="flex flex-col gap-10">
            <div className="flex flex-row gap-2">
                <Button
                    loading={isSubscribing}
                    shadowSize={!isSubscribing && !isSubscribed ? '4' : undefined}
                    disabled={isSubscribing || isSubscribed}
                    onClick={() => {
                        subscribe()
                    }}
                >
                    {isSubscribed ? 'Subscribed !' : 'Enable Notification'}
                </Button>
            </div>
        </div>
    )
}

export default NotificationPermission
