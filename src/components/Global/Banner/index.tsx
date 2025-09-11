import { usePathname } from 'next/navigation'
import { MaintenanceBanner } from './MaintenanceBanner'
import { MarqueeWrapper } from '../MarqueeWrapper'
import config from '@/config/routesUnderMaintenance'
import { HandThumbsUp } from '@/assets'
import Image from 'next/image'
import { useSupportModalContext } from '@/context/SupportModalContext'

export function Banner() {
    const pathname = usePathname()
    if (!pathname) return null

    // Don't show banner on landing page
    if (pathname === '/') return null

    // First check for maintenance
    const isUnderMaintenance = config.routes.some((route) => pathname.startsWith(route))
    if (isUnderMaintenance) {
        return <MaintenanceBanner pathname={pathname} />
    }

    // Show beta feedback banner for all paths unless under maintenance
    return <FeedbackBanner />
}

function FeedbackBanner() {
    const { setIsSupportModalOpen } = useSupportModalContext()

    const handleClick = () => {
        setIsSupportModalOpen(true)
    }

    return (
        <button onClick={handleClick} className="w-full cursor-pointer">
            <MarqueeWrapper backgroundColor="bg-primary-1" direction="left">
                <span className="z-10 mx-4 flex items-center gap-2 text-sm font-semibold">
                    Peanut is in beta! Thank you for being an early user, share your feedback here
                    <Image src={HandThumbsUp} alt="Thumbs up" className="h-4 w-4" />
                </span>
            </MarqueeWrapper>
        </button>
    )
}

export { GenericBanner } from './GenericBanner'
export { MaintenanceBanner } from './MaintenanceBanner'
