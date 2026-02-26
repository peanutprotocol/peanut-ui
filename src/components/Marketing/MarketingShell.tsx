interface MarketingShellProps {
    children: React.ReactNode
    className?: string
}

export function MarketingShell({ children, className }: MarketingShellProps) {
    return <div className={`mx-auto max-w-3xl px-4 py-8 md:py-12 ${className ?? ''}`}>{children}</div>
}
