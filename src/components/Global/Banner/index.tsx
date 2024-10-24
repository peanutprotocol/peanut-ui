import { usePathname } from 'next/navigation'
import { MarqueeWrapper } from '../MarqueeWrapper'

export function Banner() {
    const pathname = usePathname()
    const showBanner = pathname.startsWith('/cashout') || pathname.startsWith('/request')
    const isCashoutPage = pathname.startsWith('/cashout')

    if (!showBanner) return null

    return (
        <MarqueeWrapper backgroundColor={isCashoutPage ? 'bg-red' : 'bg-purple-1'} direction="left">
            <span className="mx-4 text-sm font-semibold ">
                {isCashoutPage
                    ? 'Under Maintenance - Cashout feature temporarily unavailable'
                    : 'Beta feature - share your thoughts!'}
            </span>
        </MarqueeWrapper>
    )
}
