import { twMerge } from '@/utils/tw'
import { PROSE_WIDTH } from './constants'

interface MarketingShellProps {
    children: React.ReactNode
    className?: string
}

export function MarketingShell({ children, className }: MarketingShellProps) {
    // twMerge, not interpolation: a caller's max-w-* used to lose to the shell's
    // own width class because both classes shipped and the later rule won, so the
    // width prop never did anything.
    return <div className={twMerge(`mx-auto ${PROSE_WIDTH} px-6 py-8 md:px-4 md:py-12`, className)}>{children}</div>
}
