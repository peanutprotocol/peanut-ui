import { twMerge } from '@/utils/tw'

export const MINI_HEADER_CLASS = 'text-label-m uppercase tracking-wide text-foreground-secondary'

/**
 * Grey uppercase mini-header. Labels a section of plain prose when the content
 * is neither a warning nor a caveat — the alternative to giving every block its
 * own tinted Notification, which the one-notification-per-screen rule forbids.
 */
export const MiniHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h3 className={twMerge(MINI_HEADER_CLASS, className)}>{children}</h3>
)
