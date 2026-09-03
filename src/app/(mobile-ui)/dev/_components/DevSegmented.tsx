'use client'

import { twMerge } from '@/utils/tw'

/**
 * The one segmented control for /dev pages — a small row of mutually exclusive
 * options (view modes, copy variants). Pink-fill = selected, matching DevChip's
 * `pink` tone so a selected segment and a highlighted chip read as one system.
 */
export default function DevSegmented<T extends string>({
    value,
    options,
    onChange,
    className,
    size = 'md',
}: {
    value: T
    options: { value: T; label: string; hint?: string }[]
    onChange: (next: T) => void
    className?: string
    /** `sm` for in-panel controls, `md` for page-header controls. */
    size?: 'sm' | 'md'
}) {
    return (
        <div className={twMerge('flex shrink-0 rounded-sm border border-border-default bg-white p-0.5', className)}>
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    title={option.hint}
                    aria-pressed={value === option.value}
                    onClick={() => onChange(option.value)}
                    className={twMerge(
                        'rounded-sm transition-colors',
                        size === 'sm' ? 'px-2 py-1 text-[11px] font-bold' : 'px-3 py-1.5 text-label-m',
                        value === option.value
                            ? 'bg-action-primary text-foreground-primary'
                            : 'text-foreground-secondary hover:bg-purple-200/40'
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    )
}
