import { twMerge } from '@/utils/tw'
import { DISPLAY_LINE_CLASS } from './starLp.consts'
import { heroFitStyle, heroLineEm } from './starLpHeroFit'
import type { DisplayLineProps } from './starLp.types'

/** A Roboto display line inside a heading, beside a KnerdTitle ("GET PAID FROM" over "US and EUROPE"). */
export function DisplayLine({ children, size = 'lead', className }: DisplayLineProps) {
    // A masthead line fits itself to the fold from its text; a node child keeps the CSS default width.
    const fit =
        size === 'masthead' && typeof children === 'string' ? heroFitStyle(heroLineEm(children, 'display')) : undefined
    return (
        <span
            className={twMerge(
                'font-roboto-flex-extrabold block font-extraBlack uppercase',
                DISPLAY_LINE_CLASS[size],
                className
            )}
            style={fit}
        >
            {children}
        </span>
    )
}
