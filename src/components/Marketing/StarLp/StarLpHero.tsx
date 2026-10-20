import { ProductSplitHero } from '@/components/Marketing/ProductSplitHero'
import type { StarLpHeroProps } from './starLp.types'

/**
 * The star-LP hero: the DS product-split hero in its centred mode. Phones read
 * h1, subtitle, art, CTA (the approved mock order); md+ is the split.
 * No eyebrow: kickers are off for these pages.
 */
export function StarLpHero({ title, subtitle, cta, art, artLabel }: StarLpHeroProps) {
    // The drawn UI is illustration: a screen reader should not read a fake
    // balance or chat as page content.
    const a11yArt = artLabel ? (
        <div role="img" aria-label={artLabel}>
            {art}
        </div>
    ) : (
        <div aria-hidden>{art}</div>
    )
    return <ProductSplitHero align="center" headline={title} lead={subtitle} cta={cta} art={a11yArt} />
}
