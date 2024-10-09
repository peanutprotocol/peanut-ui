import { usePathname } from 'next/navigation'
import { MarqueeWrapper } from '../MarqueeWrapper'

export function Banner() {
    const pathname = usePathname()
    const showBanner = pathname.startsWith('/cashout') || pathname.startsWith('/request')

    if (!showBanner) return null

    return (
        <MarqueeWrapper backgroundColor="bg-purple-1" direction="left">
            <span className="mx-4 text-sm font-semibold ">This feature is currently in beta.</span>
        </MarqueeWrapper>
    )
}
