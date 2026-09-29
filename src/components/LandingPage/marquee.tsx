import HandThumbsUp from '@/assets/illustrations/hand-thumbs-up.svg'
import { MarqueeComp } from '../Global/MarqueeWrapper'
import type { MarqueeItem } from '../Global/MarqueeWrapper/marquee.types'

type MarqueeProps = {
    visible?: boolean
    /** Plain words, or `{ label, href }` for the ones that link somewhere. Each caller brings its own localized words. */
    message: MarqueeItem[]
    imageSrc?: string
    backgroundColor?: string
}

export function Marquee({
    visible = true,
    message,
    imageSrc = HandThumbsUp.src,
    backgroundColor = 'bg-yellow-500',
}: MarqueeProps) {
    if (!visible) return null

    return (
        <div className="relative z-1">
            <MarqueeComp message={message} imageSrc={imageSrc} backgroundColor={backgroundColor} />
        </div>
    )
}
