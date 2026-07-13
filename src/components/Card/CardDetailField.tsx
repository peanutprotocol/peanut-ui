'use client'
import { type FC } from 'react'
import { twMerge } from 'tailwind-merge'

interface Props {
    /** The value to display AND expose to the password manager. */
    value: string
    /** Autocomplete token the password manager keys off (e.g. `cc-number`). */
    autoComplete: 'cc-number' | 'cc-name' | 'cc-exp' | 'cc-csc'
    /** Field name — a second detection hint for managers that sniff names. */
    name: string
    /** Accessible label — the sizer span is aria-hidden, so the input owns a11y. */
    ariaLabel: string
    /** Typography classes, applied to BOTH sizer and input so widths match. */
    className?: string
}

/**
 * A readOnly card-detail value rendered as a real `<input>` so password managers
 * recognise it (via `autoComplete`) and offer to save the card — while staying
 * pixel-identical to plain text.
 *
 * `<input>` can't shrink-to-fit its value (no `field-sizing: content` on iOS
 * Safari), so we size it with an invisible sizer span in the same font: the
 * span reserves the exact text width, the input overlays it `inset-0`. Result:
 * a genuinely-visible, manager-detectable field with zero layout shift vs the
 * `<span>` it replaced. `ph-no-capture` on both keeps the value (PII/PAN) out of
 * session recordings.
 */
const CardDetailField: FC<Props> = ({ value, autoComplete, name, ariaLabel, className }) => (
    <span className="relative inline-block">
        <span aria-hidden className={twMerge('ph-no-capture invisible block whitespace-pre', className)}>
            {value}
        </span>
        <input
            type="text"
            readOnly
            name={name}
            autoComplete={autoComplete}
            aria-label={ariaLabel}
            value={value}
            className={twMerge(
                'ph-no-capture absolute inset-0 w-full whitespace-pre border-0 bg-transparent p-0 text-n-1 outline-none',
                className
            )}
        />
    </span>
)

export default CardDetailField
