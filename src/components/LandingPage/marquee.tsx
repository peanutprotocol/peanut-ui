import { HandThumbsUp } from '@/assets'
import { MarqueeComp } from '../Global/MarqueeWrapper'

type MarqueeProps = {
    visible?: boolean
    message?: string[]
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
            <MarqueeComp message={message} imageSrc={imageSrc} backgroundColor={backgroundColor} />
        </div>
    )
}
