import { MAINTAINABLE_ROUTES } from '@/config/routesUnderMaintenance'
import { usePathname } from 'next/navigation'
import { GenericBanner } from './GenericBanner'
import { MaintenanceBanner } from './MaintenanceBanner'

export function Banner() {
    const pathname = usePathname()
    if (!pathname) return null

    // First check for maintenance
    const maintenanceBanner = <MaintenanceBanner pathname={pathname} />
    if (maintenanceBanner) return maintenanceBanner

    // Show beta message for all request paths (create and pay) unless under maintenance
    if (pathname.startsWith(MAINTAINABLE_ROUTES.REQUEST)) {
        return <GenericBanner message="Beta feature - share your thoughts!" backgroundColor="bg-primary-1" />
    }

    return null
}

export { GenericBanner } from './GenericBanner'
export { MaintenanceBanner } from './MaintenanceBanner'
