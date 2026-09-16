'use client'
import { type FC } from 'react'
import { useTranslations } from 'next-intl'
import { twMerge } from '@/utils/tw'

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
    const t = useTranslations('card.pin')

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, length)
        onChange(digits)
    }

    return (
        <label
            // posthog skips this subtree in session replays.
            // this keeps pin digits and the filled-dot count out of recordings.
            className={twMerge(
                'ph-no-capture flex items-center justify-center gap-4 rounded-sm outline-action-focus focus-within:outline-[3px] focus-within:outline-solid',
                className
            )}
        >
            {Array.from({ length }).map((_, i) => {
                const filled = i < value.length
                return (
                    <span
                        key={i}
                        aria-hidden="true"
                        className={twMerge(
                            'h-5 w-5 rounded-round border border-foreground-primary transition-colors',
                            filled ? 'bg-foreground-primary' : ''
                        )}
                    />
                )
            })}
            <input
                type="tel"
                inputMode="numeric"
                autoFocus={autoFocus}
                value={value}
                onChange={handleChange}
                maxLength={length}
                className="sr-only"
                aria-label={t('inputAriaLabel')}
                disabled={disabled}
            />
        </label>
    )
}

export default PinInput
