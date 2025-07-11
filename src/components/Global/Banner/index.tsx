import { usePathname, useRouter } from 'next/navigation'
import { MaintenanceBanner } from './MaintenanceBanner'
import { MarqueeWrapper } from '../MarqueeWrapper'
import config from '@/config/routesUnderMaintenance'

export function Banner() {
    const pathname = usePathname()
    if (!pathname) return null

    // First check for maintenance
    const isUnderMaintenance = config.routes.some((route) => pathname.startsWith(route))
    if (isUnderMaintenance) {
        return <MaintenanceBanner pathname={pathname} />
    }

    // Show beta feedback banner for all paths unless under maintenance
    return <FeedbackBanner />
}

function FeedbackBanner() {
    const router = useRouter()

    const handleClick = () => {
        router.push('/support')
    }

    return (
        <MarqueeWrapper backgroundColor="bg-primary-1" direction="left">
            <button onClick={handleClick} className="z-10 mx-4 cursor-pointer text-sm font-semibold hover:underline">
                Peanut is in beta! Thank you for being an early user, share your feedback here
            </button>
        </MarqueeWrapper>
    )
}

export { GenericBanner } from './GenericBanner'
export { MaintenanceBanner } from './MaintenanceBanner'
