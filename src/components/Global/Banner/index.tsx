import { GenericBanner } from './GenericBanner'

export function Banner() {
    return (
        <GenericBanner
            message="⚠️ UNMAINTAINED: This version is no longer supported. For the latest version with ongoing updates, please visit: peanut.me"
            backgroundColor="bg-purple-1"
        />
    )
    /*
    const pathname = usePathname()
    if (!pathname) return null

    // First check for maintenance
    const maintenanceBanner = <MaintenanceBanner pathname={pathname} />
    if (maintenanceBanner) return maintenanceBanner

    // Show beta message for all request paths (create and pay) unless under maintenance
    if (pathname.startsWith(MAINTAINABLE_ROUTES.REQUEST)) {
        return <GenericBanner message="Beta feature - share your thoughts!" backgroundColor="bg-purple-1" />
    }

    return null

    */
}

export { GenericBanner } from './GenericBanner'
export { MaintenanceBanner } from './MaintenanceBanner'
