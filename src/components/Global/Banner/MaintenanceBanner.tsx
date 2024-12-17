import { GenericBanner } from './GenericBanner'
import config from '@/config/routesUnderMaintenance'

interface MaintenanceBannerProps {
    pathname: string
}

export function MaintenanceBanner({ pathname }: MaintenanceBannerProps) {
    const isUnderMaintenance = config.routes.some((route) => pathname.startsWith(route))

    if (!isUnderMaintenance) {
        return null
    }

    return <GenericBanner message="Under maintenance" icon="⚠️" />
}
