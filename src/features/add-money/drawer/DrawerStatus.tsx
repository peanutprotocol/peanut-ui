import type { ReactNode } from 'react'

/**
 * A status inside the add-money drawer, under its one title "Add money" (design.md: a multi-step flow
 * keeps one title across all steps). The status names itself in body text, never as a second heading.
 */
export function DrawerStatus({
    icon,
    name,
    body,
    children,
    testId,
}: {
    icon: ReactNode
    name: string
    body?: ReactNode
    /** the actions, stacked full width */
    children?: ReactNode
    testId?: string
}) {
    return (
        <div className="flex flex-col items-center gap-4 text-center" data-testid={testId}>
            {icon}
            <div className="flex flex-col gap-1">
                <p className="text-body-m-semibold text-foreground-primary">{name}</p>
                {body && <p className="text-body-s text-foreground-secondary">{body}</p>}
            </div>
            {children && <div className="flex w-full flex-col gap-2">{children}</div>}
        </div>
    )
}
