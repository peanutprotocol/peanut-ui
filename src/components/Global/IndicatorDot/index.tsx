import { twMerge } from '@/utils/tw'

/**
 * The small pink status dot.
 *
 * Neutral name on purpose: it marks "pending" on a transaction card,
 * "claimable" on a perk carousel card, and "unread" on the support nav icon.
 * Pass className for size, animation or position overrides.
 */
const IndicatorDot = ({ className, ...props }: React.ComponentPropsWithoutRef<'span'>) => (
    <span className={twMerge('block h-2.5 w-2.5 rounded-full bg-action-primary', className)} {...props} />
)

export default IndicatorDot
