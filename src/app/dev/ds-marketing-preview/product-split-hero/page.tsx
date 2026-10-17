'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { ScaledPixelatedCardFace } from '@/components/Card/share-asset/ScaledPixelatedCardFace'
import { ProductSplitHero } from '@/components/Marketing/ProductSplitHero'
import { CTA_MOTION } from '@/components/Marketing/constants'

/**
 * The /shhhhh split promoted to THE sub-LP hero (q4, ruled 2026-10-15): copy
 * column left, product art right, one white secondary CTA on the pink band.
 * This renders the real component with demo copy, so the gallery shows what a
 * star-feature LP gets by calling it.
 */
export default function ProductSplitHeroPreview() {
    return (
        <main className="bg-background-page">
            <ProductSplitHero
                eyebrow="Peanut Card"
                headline="SPEND ANYWHERE"
                pitch="One product, one promise, one fold"
                lead="Copy column left, product art right. A sub-LP leads with the one star feature it sells — the key visual stays on the main LP."
                cta={
                    <Button size="large" variant="secondary" className={`w-fit ${CTA_MOTION}`}>
                        Get started
                    </Button>
                }
                art={
                    <div className="-rotate-6">
                        <ScaledPixelatedCardFace />
                    </div>
                }
                disclaimer="Legal fine print rides under the product art — the same slot /shhhhh established."
            />
        </main>
    )
}
