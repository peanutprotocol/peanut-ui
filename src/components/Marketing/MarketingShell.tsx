import { twMerge } from '@/utils/tw'

interface MarketingShellProps {
    children: React.ReactNode
    className?: string
}

export function MarketingShell({ children, className }: MarketingShellProps) {
    // twMerge, not interpolation: a caller's max-w-* used to lose to the shell's
    // own max-w-3xl because both classes shipped and the later rule won, so the
    // width prop never did anything.
    return <div className={twMerge('mx-auto max-w-3xl px-4 py-8 md:py-12', className)}>{children}</div>
}
