import { usePathname } from 'next/navigation'
import { MarqueeWrapper } from '../MarqueeWrapper'

export function Banner() {
    const pathname = usePathname()
    const isCashout = pathname.startsWith('/cashout')
    const isRequest = pathname.startsWith('/request')

    // Return null if not on cashout or request pages
    if (!isCashout && !isRequest) return null

    // Show maintenance message for cashout
    if (isCashout) {
        return (
            <MarqueeWrapper backgroundColor="bg-purple-1" direction="left">
                <span className="z-10 mx-4 text-sm font-semibold">⚠️ Under maintenance</span>
            </MarqueeWrapper>
        )
    }

    // Show beta message for request
    return (
        <MarqueeWrapper backgroundColor="bg-purple-1" direction="left">
            <span className="z-10 mx-4 text-sm font-semibold">Beta feature - share your thoughts!</span>
        </MarqueeWrapper>
    )
}
