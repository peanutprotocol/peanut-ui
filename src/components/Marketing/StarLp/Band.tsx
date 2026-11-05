import { twMerge } from '@/utils/tw'
import { MARKETING_BAND_PADDING } from '@/constants/layout.consts'
import { BAND_GROUND_CLASS, BAND_WIDTH_CLASS } from './starLp.consts'
import type { BandProps } from './starLp.types'

/** A full-bleed marketing band with the DS gutter, band padding and one centred column. */
export function Band({ ground, width = 'landing', align = 'start', id, className, label, children }: BandProps) {
    return (
        <section
            id={id}
            aria-label={label}
            className={twMerge(
                'relative overflow-hidden',
                MARKETING_BAND_PADDING,
                BAND_GROUND_CLASS[ground],
                className
            )}
        >
            <div
                className={twMerge(
                    'relative z-10 mx-auto',
                    BAND_WIDTH_CLASS[width],
                    align === 'center' && 'text-center'
                )}
            >
                {children}
            </div>
        </section>
    )
}
