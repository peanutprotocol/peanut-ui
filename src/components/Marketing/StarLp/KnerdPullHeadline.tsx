'use client'

import Title from '@/components/0_Bruddle/Title'
import { KNERD_PULL_HELP_ID } from './starLp.consts'
import { knerdPullFitStyle } from './starLpHeroFit'
import type { KnerdPullHeadlineProps } from './starLp.types'
import { useKnerdFollowThePull } from './useKnerdFollowThePull'

/**
 * The oversized hero Knerd with Follow the pull (design.md § Knerd hero
 * animation): the wide phrase above 600px, the stacked lines at 600px and
 * below. Both copies render on the server at their fitted size, so nothing
 * moves when the script arrives; CSS shows one of them. Only the letters
 * move: the lines around it, the art and the CTA stay still. Its no-JS style
 * and how-to live outside the h1 (KnerdPullSupport, rendered by the hero).
 */
export function KnerdPullHeadline({ text, join }: KnerdPullHeadlineProps) {
    const ref = useKnerdFollowThePull()
    return (
        <span
            ref={ref}
            data-knerd-pull="pending"
            tabIndex={0}
            aria-describedby={KNERD_PULL_HELP_ID}
            className="star-lp-knerd-fit block cursor-default touch-pan-y outline-offset-8 focus-visible:outline-[3px] focus-visible:outline-action-focus focus-visible:outline-solid"
            style={knerdPullFitStyle(text, join)}
        >
            {/* display:none drops the hidden copy from the accessibility tree, so the h1 reads the phrase once */}
            <span className="star-lp-knerd-copy star-lp-knerd-wide">
                <Title text={text.replace(/\n/g, ' ')} letters join={join} />
            </span>
            <span className="star-lp-knerd-copy star-lp-knerd-stacked">
                <Title text={text} letters join={join} />
            </span>
        </span>
    )
}
