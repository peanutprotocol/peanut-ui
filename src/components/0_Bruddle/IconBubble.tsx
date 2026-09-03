import { twMerge } from '@/utils/tw'
import { Icon, type IconName } from '../Global/Icons/Icon'

type IconBubbleSize = 'xs' | 's' | 'm' | 'l'
export type IconBubbleColor = 'green' | 'red' | 'yellow' | 'gray' | 'blue' | 'logo'

interface IconBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
    icon: IconName | React.ReactElement
    size?: IconBubbleSize
    color?: IconBubbleColor
    iconClassName?: string
}

// board 17802:61528: bubble sizes xs=24 s=32 m=48 l=72
const bubbleSizes: Record<IconBubbleSize, string> = {
    xs: 'size-6',
    s: 'size-8',
    m: 'size-12',
    l: 'size-18',
}

// board icon per bubble: xs/s = 16, m = 24, l = 40 (the l bubble is the
// empty/error hero, so it takes the one off-scale step the icon law allows)
const bubbleIconSizes: Record<IconBubbleSize, number> = {
    xs: 16,
    s: 16,
    m: 24,
    l: 40,
}

const bubbleColors: Record<IconBubbleColor, string> = {
    green: 'bg-background-icon-bubble-green',
    red: 'bg-background-icon-bubble-red',
    yellow: 'bg-background-icon-bubble-yellow',
    gray: 'bg-background-icon-bubble-gray',
    blue: 'bg-background-icon-bubble-blue',
    // board icon.bubble.color.logo (17370:154707): brand/payment mark fills the
    // bubble — no colored background, content clipped round
    logo: 'overflow-hidden',
}

/**
 * Round colored icon container from the figma icon-bubble board (17802:61528).
 * Sizes: xs=24, s=32, m=48 (card default), l=72px.
 */
export const IconBubble = ({
    icon,
    size = 'm',
    color = 'green',
    className,
    iconClassName,
    ...props
}: IconBubbleProps) => (
    <div
        className={twMerge(
            'flex shrink-0 items-center justify-center rounded-round text-foreground-primary',
            bubbleSizes[size],
            bubbleColors[color],
            className
        )}
        {...props}
    >
        {typeof icon === 'string' ? (
            <Icon name={icon as IconName} size={bubbleIconSizes[size]} className={iconClassName} />
        ) : (
            icon
        )}
    </div>
)
