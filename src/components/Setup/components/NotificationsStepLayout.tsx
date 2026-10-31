import { type ReactNode } from 'react'
import SetupTitleBlock from './SetupTitleBlock'

/**
 * The notifications step renders its own heading, because each experiment
 * variant has its own copy. The spacing repeats SetupWrapper's title-to-content gap.
 */
export default function NotificationsStepLayout({
    title,
    description,
    titleClassName,
    children,
}: {
    title: ReactNode
    description?: ReactNode
    titleClassName?: string
    children: ReactNode
}) {
    return (
        <div className="flex w-full flex-1 flex-col gap-8 compact:gap-6 short:gap-4 tight:gap-3">
            <SetupTitleBlock
                title={title}
                description={description}
                className="md:max-h-48 md:max-w-xs"
                titleClassName={titleClassName}
            />
            <div className="flex w-full flex-1 flex-col gap-6">{children}</div>
        </div>
    )
}
