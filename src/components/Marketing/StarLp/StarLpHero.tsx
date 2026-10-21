import { ProductSplitHero } from '@/components/Marketing/ProductSplitHero'
import { DisplayLine } from './DisplayLine'
import type { StarLpHeroProps } from './starLp.types'

/**
 * The star-LP hero: the DS product-split hero in its centred mode, the
 * peanut.me hero composition. A Roboto line sits on a giant Knerd, both sized
 * to fill the fold; the art tucks up under the Knerd (or stands on the bottom
 * edge), and the tail line, lead and CTA follow inside the first screen.
 * No eyebrow: kickers are off for these pages.
 */
export function StarLpHero({ title, titleTail, subtitle, cta, art, artLabel, artPlacement }: StarLpHeroProps) {
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
            headline={title}
            headlineTail={titleTail && <DisplayLine size="masthead">{titleTail}</DisplayLine>}
            lead={subtitle}
            cta={cta}
            art={a11yArt}
            artPlacement={artPlacement}
        />
    )
}
