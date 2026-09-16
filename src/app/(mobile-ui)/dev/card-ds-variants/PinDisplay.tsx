'use client'

import { twMerge } from '@/utils/tw'

interface Props {
    pin: string
    revealed: boolean
    className?: string
}

/**
 * Read-only PIN cells for the /dev/card-ds-variants proposals. Echoes the
 * PinInput visual language (round filled dot, gap-4, foreground border) but
 * as four bordered cells: masked shows a dot per cell, revealed shows the
 * digit. Display only — the real input stays PinInput.
 */
const PinDisplay = ({ pin, revealed, className }: Props) => (
    // ph-no-capture: same replay exclusion as PinInput, digits never recorded
    <div className={twMerge('ph-no-capture flex items-center gap-4', className)} aria-hidden="true">
        {pin.split('').map((digit, i) => (
            <span
                key={i}
                className="flex h-12 w-10 items-center justify-center rounded-sm border border-foreground-primary"
            >
                {revealed ? (
                    <span className="text-heading-s">{digit}</span>
                ) : (
                    <span className="size-2 rounded-round bg-foreground-primary" />
                )}
            </span>
        ))}
    </div>
)

export default PinDisplay
