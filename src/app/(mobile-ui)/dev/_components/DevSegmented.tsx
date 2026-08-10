'use client'

import { twMerge } from 'tailwind-merge'

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
        <div className={twMerge('flex shrink-0 rounded-sm border border-n-1 bg-white p-0.5', className)}>
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    title={option.hint}
                    aria-pressed={value === option.value}
                    onClick={() => onChange(option.value)}
                    className={twMerge(
                        'rounded-sm font-bold transition-colors',
                        size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
                        value === option.value ? 'bg-primary-1 text-n-1' : 'text-grey-1 hover:bg-primary-3/40'
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    )
}
