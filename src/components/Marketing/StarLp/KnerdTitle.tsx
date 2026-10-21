import Title from '@/components/0_Bruddle/Title'
import { twMerge } from '@/utils/tw'
import { KNERD_SIZE_CLASS } from './starLp.consts'
import { HERO_FIT_CLASS, heroFitStyle, heroLineEm } from './starLpHeroFit'
import type { KnerdTitleProps } from './starLp.types'

/** [stacked copy, one-row copy]. `md` lives in globals.css: a phone also
    keeps the row when it is too short to stack and still show the CTA. */
const ONE_LINE_FROM_CLASS = {
    md: ['star-lp-knerd-stack-md', 'block star-lp-knerd-row-md'],
    lg: ['block lg:hidden', 'hidden lg:block'],
} as const

/** The DS knerd `Title` at a preset size, so the six pages share one scale. */
export function KnerdTitle({ text, size, className, oneLineFrom }: KnerdTitleProps) {
    const title = (lines: string) => <Title text={lines} className={twMerge(KNERD_SIZE_CLASS[size], className)} />
    if (size !== 'masthead') return title(text)
    // The fit size sits on a wrapper because Title takes no style; Title inherits it.
    const fitted = (lines: string, visibility?: string) => (
        <span
            className={twMerge(HERO_FIT_CLASS.knerd, visibility ?? 'block')}
            style={heroFitStyle(heroLineEm(lines, 'knerd'), lines.split('\n').length)}
        >
            {title(lines)}
        </span>
    )
    if (!oneLineFrom || !text.includes('\n')) return fitted(text)
    // Wide screens set the words on one row, so the Knerd spans the column.
    // display:none also drops the other copy from the accessibility tree, so the h1 reads once.
    const [stacked, row] = ONE_LINE_FROM_CLASS[oneLineFrom]
    return (
        <>
            {fitted(text, stacked)}
            {fitted(text.replace(/\n/g, ' '), row)}
        </>
    )
}
