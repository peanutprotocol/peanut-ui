'use client'
import { type FC, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

interface Props {
    value: string
    onChange: (v: string) => void
    length?: number
    autoFocus?: boolean
    disabled?: boolean
    className?: string
}

/**
 * Simple PIN input: 4 dots showing filled/empty state, backed by a single
 * numeric input that accepts only digits and auto-trims to `length`. Tapping
 * the dots focuses the input so mobile keyboards open.
 */
const PinInput: FC<Props> = ({ value, onChange, length = 4, autoFocus = true, disabled = false, className }) => {
    const inputRef = useRef<HTMLInputElement>(null)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, length)
        onChange(digits)
    }

    return (
        <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            className={twMerge('flex items-center justify-center gap-4', className)}
            disabled={disabled}
        >
            {Array.from({ length }).map((_, i) => {
                const filled = i < value.length
                return (
                    <span
                        key={i}
                        aria-hidden="true"
                        className={twMerge(
                            'h-5 w-5 rounded-full border border-n-1 transition-colors',
                            filled ? 'bg-n-1' : ''
                        )}
                    />
                )
            })}
            <input
                ref={inputRef}
                type="tel"
                inputMode="numeric"
                autoFocus={autoFocus}
                value={value}
                onChange={handleChange}
                maxLength={length}
                className="pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0"
                aria-label="PIN input"
                disabled={disabled}
            />
        </button>
    )
}

export default PinInput
