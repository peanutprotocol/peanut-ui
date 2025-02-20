import { GenericBanner } from './GenericBanner'
import config from '@/config/routesUnderMaintenance'

interface MaintenanceBannerProps {
    pathname: string
}

export function MaintenanceBanner({ pathname }: MaintenanceBannerProps) {
    const isUnderMaintenance = config.routes.some((route) => pathname.startsWith(route))

    // Check if we're within the maintenance window
    const now = Date.now() // Current time in milliseconds
    const startTime = config.maintenanceTime ? new Date(config.maintenanceTime.start).getTime() : null
    const endTime = config.maintenanceTime ? new Date(config.maintenanceTime.end).getTime() : null

    const isWithinMaintenanceWindow =
        config.maintenanceTime && startTime && endTime && now >= startTime && now <= endTime

    if (!isUnderMaintenance || !isWithinMaintenanceWindow) {
        return null
    }

    const formatDate = (timestamp: number) => new Date(timestamp).toUTCString()
    const maintenanceMessage = config.maintenanceTime
        ? `Scheduled maintenance. Some features might be unavailable.`
        : 'Under maintenance'

    return <GenericBanner message={maintenanceMessage} icon="⚠️" backgroundColor="bg-yellow-100" />
}
