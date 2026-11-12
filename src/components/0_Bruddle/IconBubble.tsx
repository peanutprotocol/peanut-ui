import { twMerge } from '@/utils/tw'
import { Icon, type IconName } from '../Global/Icons/Icon'

type IconBubbleSize = 'xs' | 's' | 'm' | 'l' | 'xl'
/**
 * One meaning per color (TASK-22761, TASK-23054). A product concept takes its
 * pair from CONCEPT_ICONS, and its color names the concept, never its status:
 * the row's badge carries the status.
 * - blue: a method or plain information (bank, links, add money, withdraw).
 * - yellow: crypto, Peanut's own concepts (the Peanut user, friends, card, rewards, badges), and
 *   attention in a modal or callout (pending, warnings).
 * - brand (pink): the primary action, QR pay, the same pink as the bottom nav QR button.
 * - green: done. success screens, completed steps.
 * - red: failed or blocked. errors, destructive confirms, failed-to-load states.
 * - gray: inactive. not available, cancelled, empty results.
 */
export type IconBubbleColor = 'green' | 'red' | 'yellow' | 'gray' | 'blue' | 'brand'

interface IconBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
    icon: IconName | React.ReactElement
    size?: IconBubbleSize
    color?: IconBubbleColor
    iconClassName?: string
}

// board 17802:61528: bubble sizes xs=24 s=32 m=48 l=72. xl=96 has no board
// row: it is the avatar xl, for a bubble that stands in for a person in a
// 96 px header slot (the payment details header), so it matches the avatar.
const bubbleSizes: Record<IconBubbleSize, string> = {
    xs: 'size-6',
    s: 'size-8',
    m: 'size-12',
    l: 'size-18',
    xl: 'size-24',
}

// board icon per bubble: xs/s = 16, m = 24, l = 40 (the l bubble is the
// empty/error hero, so it takes the one off-scale step the icon law allows).
// xl = 48, half the bubble like s and m, and the avatar xl's icon.
const bubbleIconSizes: Record<IconBubbleSize, number> = {
    xs: 16,
    s: 16,
    m: 24,
    l: 40,
    xl: 48,
}

const bubbleColors: Record<IconBubbleColor, string> = {
    green: 'bg-background-icon-bubble-green',
    red: 'bg-background-icon-bubble-red',
    yellow: 'bg-background-icon-bubble-yellow',
    gray: 'bg-background-icon-bubble-gray',
    blue: 'bg-background-icon-bubble-blue',
    // no iconBubble/brand variable exists in figma; the brand fill is the
    // same semantic token the brand surfaces already use.
    brand: 'bg-background-brand',
}

/**
 * Round colored icon container from the figma icon-bubble board (17802:61528).
 * Sizes: xs=24, s=32, m=48 (card default), l=72, xl=96px (person slot only).
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
            'flex shrink-0 items-center justify-center rounded-full text-foreground-primary',
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
