import HandThumbsUp from '@/assets/illustrations/hand-thumbs-up.svg'
import { MarqueeCss } from './MarqueeCss'
import type { MarqueeItem } from '../Global/MarqueeWrapper/marquee.types'

type MarqueeProps = {
    visible?: boolean
    /** Plain words, or `{ label, href }` for the ones that link somewhere. */
    message?: MarqueeItem[]
    imageSrc?: string
    backgroundColor?: string
}

export function Marquee({
    visible = true,
    message = ['No fees', 'Instant', '24/7', 'Dollars', 'USDT/USDC'],
    imageSrc = HandThumbsUp.src,
    backgroundColor = 'bg-secondary-1',
}: MarqueeProps) {
    if (!visible) return null

    return (
        <div className="relative z-1">
            <MarqueeCss message={message} imageSrc={imageSrc} backgroundColor={backgroundColor} />
        </div>
    )
}
