import { Button } from '@/components/0_Bruddle'
import Icon from '@/components/Global/Icon'
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
                    <Icon name={isSubscribed ? 'notification-bell' : 'notification'} className="mr-2" />
                    {isSubscribed ? 'Subscribed !' : 'Enable Notifications'}
                </Button>
            </div>
        </div>
    )
}

export default NotificationPermission
