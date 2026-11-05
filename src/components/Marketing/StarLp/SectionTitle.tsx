import { twMerge } from '@/utils/tw'
import { SECTION_TITLE_CLASS } from './starLp.consts'
import type { SectionTitleProps } from './starLp.types'

/**
 * A fold's h2: Roboto Flex extra-black caps, balanced so no line is a widow.
 * `star-lp-section-title` sets it solid (globals.css) so commas clear the next
 * line. For a two-sentence title, wrap each sentence in `<span className="block">`.
 */
export function SectionTitle({ children, size = 'fold', className }: SectionTitleProps) {
    return (
        <h2
            className={twMerge(
                'font-roboto-flex-extrabold star-lp-section-title font-extraBlack text-balance uppercase',
                SECTION_TITLE_CLASS[size],
                className
            )}
        >
            {children}
        </h2>
    )
}
