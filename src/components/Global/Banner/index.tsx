import { GenericBanner } from './GenericBanner'
import { usePathname } from 'next/navigation'

export function Banner() {
    const pathname = usePathname()
    if (pathname === '/cashout') return null
    return (
        <GenericBanner
            message="New product out! Try peanut.me now and earn rewards on our Beta program"
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
