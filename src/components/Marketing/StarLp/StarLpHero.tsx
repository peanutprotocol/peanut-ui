import { ProductSplitHero } from '@/components/Marketing/ProductSplitHero'
import { DisplayLine } from './DisplayLine'
import { KnerdPullHeadline } from './KnerdPullHeadline'
import { KnerdPullSupport } from './KnerdPullSupport'
import { knerdPullFitStyle } from './starLpHeroFit'
import type { StarLpHeroProps } from './starLp.types'

/**
 * The star-LP hero: the DS product-split hero in its centred mode, the
 * peanut.me hero composition. A Roboto line sits on a giant Knerd with Follow
 * the pull, both sized to fill the fold; the art tucks up under the Knerd (or
 * stands on the bottom edge), and the tail line, lead and CTA follow inside
 * the first screen. Only the Knerd letters move.
 * No eyebrow: kickers are off for these pages.
 */
export function StarLpHero({
    lead,
    knerd,
    knerdJoin,
    titleTail,
    subtitle,
    cta,
    art,
    artLabel,
    artPlacement,
    artTuck,
}: StarLpHeroProps) {
    // The drawn UI is illustration: a screen reader should not read a fake
    // balance or chat as page content.
    const a11yArt = artLabel ? (
        <div role="img" aria-label={artLabel}>
            {art}
        </div>
    ) : (
        <div aria-hidden>{art}</div>
    )
    return (
        <ProductSplitHero
            align="center"
            headline={
                <>
                    <DisplayLine size="masthead">{lead}</DisplayLine>
                    <KnerdPullHeadline text={knerd} join={knerdJoin} />
                </>
            }
            headlineTail={titleTail && <DisplayLine size="masthead">{titleTail}</DisplayLine>}
            lead={subtitle}
            cta={cta}
            art={a11yArt}
            artPlacement={artPlacement}
            artTuck={artTuck}
            support={<KnerdPullSupport />}
            knerdFit={knerdPullFitStyle(knerd, knerdJoin)}
        />
    )
}
