import { Icon } from '@/components/Global/Icons/Icon'
import { twMerge } from '@/utils/tw'

/**
 * The tilted @name chip under a stage headline (the Celebration, the verified page). `verified` adds the green
 * check: the verified page shows it only once a provider account works (Aleks).
 */
export function NameChip({
    username,
    verified = true,
    className,
}: {
    username: string
    verified?: boolean
    className?: string
}) {
    return (
        <span
            // ds text tokens stay outside twMerge: it reads them as colours and drops the size
            className={`text-label-l ${twMerge(
                'shadow-2 inline-flex h-7 -rotate-3 items-center gap-1 rounded-sm border border-border-default bg-background-default px-2',
                className
            )}`}
            data-testid="name-chip"
            data-verified={verified || undefined}
        >
            {verified && (
                <span className="flex size-5 items-center justify-center rounded-full bg-background-icon-bubble-green text-foreground-inverse">
                    <Icon name="check" size={14} strokeWidth={3} />
                </span>
            )}
            {`@${username}`}
        </span>
    )
}
