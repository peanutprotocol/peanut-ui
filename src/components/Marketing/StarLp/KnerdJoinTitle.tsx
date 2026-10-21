import Title from '@/components/0_Bruddle/Title'
import { DisplayLine } from './DisplayLine'
import { HERO_FIT_CLASS, heroFitStyle, heroLineEm } from './starLpHeroFit'
import type { KnerdJoinTitleProps } from './starLp.types'

/** The small Roboto joiner sits at this share of the Knerd size, with this gap (em) either side. */
const JOIN_SCALE = 0.3
const JOIN_GAP_EM = 0.12

/**
 * A masthead Knerd pair joined by a small Roboto word ("US and EUROPE").
 * From md it is one fitted row. Phones tall enough to keep the CTA in view
 * stack it ("US and" over "EUROPE"), so the Knerd outranks the Roboto line
 * above it; both rows share one size, fitted to the wider of the two.
 */
export function KnerdJoinTitle({ left, join, right }: KnerdJoinTitleProps) {
    const leftJoinEm = heroLineEm(left, 'knerd') + JOIN_SCALE * heroLineEm(join, 'display') + JOIN_GAP_EM
    const rowEm = leftJoinEm + heroLineEm(right, 'knerd') + JOIN_GAP_EM
    const stackEm = Math.max(leftJoinEm, heroLineEm(right, 'knerd'))
    const rowClass = 'flex items-center justify-center gap-x-[0.12em]'
    const joiner = (
        <DisplayLine size="join" className="lowercase">
            {join}
        </DisplayLine>
    )
    // Spaces between the flex items render nothing but keep the words apart for a
    // screen reader. display:none drops the inactive copy from the accessibility tree.
    return (
        <>
            <span className={`${HERO_FIT_CLASS.knerd} star-lp-knerd-row-md ${rowClass}`} style={heroFitStyle(rowEm)}>
                <Title text={left} /> {joiner} <Title text={right} />
            </span>
            <span className={`${HERO_FIT_CLASS.knerd} star-lp-knerd-stack-md`} style={heroFitStyle(stackEm, 2)}>
                <span className={rowClass}>
                    <Title text={left} /> {joiner}
                </span>{' '}
                <span className="mt-[0.08em] flex justify-center">
                    <Title text={right} />
                </span>
            </span>
        </>
    )
}
