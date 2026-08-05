import { GenericBanner } from './GenericBanner'

export function ConnectivityBanner({ isOffline }: { isOffline: boolean }) {
    return (
        <GenericBanner
            icon={isOffline ? '📡' : '⚠️'}
            message={
                isOffline
                    ? "No internet connection — some features won't work until you reconnect"
                    : 'Trouble reaching Peanut — check your connection, retrying…'
            }
        />
    )
}
