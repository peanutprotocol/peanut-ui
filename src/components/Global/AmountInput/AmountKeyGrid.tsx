'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { pressAmountKey, type AmountKey } from './keypad.utils'

const KEYS: { label: string; value: AmountKey }[] = [
    { label: '1', value: '1' },
    { label: '2', value: '2' },
    { label: '3', value: '3' },
    { label: '4', value: '4' },
    { label: '5', value: '5' },
    { label: '6', value: '6' },
    { label: '7', value: '7' },
    { label: '8', value: '8' },
    { label: '9', value: '9' },
    { label: '.', value: 'decimal' },
    { label: '0', value: '0' },
    { label: '⌫', value: 'delete' },
]

interface AmountKeyGridProps {
    value: string
    onChange: (value: string) => void
    maxDecimals?: number
    disabled?: boolean
    className?: string
}

export function AmountKeyGrid({
    value,
    onChange,
    maxDecimals = 2,
    disabled = false,
    className = '',
}: AmountKeyGridProps) {
    const t = useTranslations('payment.amountEntry')

    return (
        <div role="group" aria-label={t('keypad')} className={`grid w-full grid-cols-3 ${className}`}>
            {KEYS.map(({ label, value: key }, index) => (
                <div
                    key={key}
                    className={`${index % 3 !== 2 ? 'border-r' : ''} ${index < 9 ? 'border-b' : ''} border-border-subtle`}
                >
                    <Button
                        type="button"
                        variant="ghost"
                        className="h-15 w-full rounded-none p-0 text-heading-s"
                        onClick={() => onChange(pressAmountKey(value, key, maxDecimals))}
                        aria-label={key === 'delete' ? t('delete') : key === 'decimal' ? t('decimal') : label}
                        disabled={disabled}
                    >
                        {label}
                    </Button>
                </div>
            ))}
        </div>
    )
}
