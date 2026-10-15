import Image from 'next/image'
import { Star } from '@/assets/illustrations'
import { Button } from '@/components/0_Bruddle/Button'
import { ScaledPixelatedCardFace } from '@/components/Card/share-asset/ScaledPixelatedCardFace'

/**
 * The /shhhhh split promoted to THE sub-LP hero (q4, ruled 2026-10-15): copy
 * column left, product art right, one white secondary CTA on the pink band.
 * Static rebuild from the real primitives — no reusable component exists yet;
 * the canonical one lands in ds-marketing-heroes. Ruled deltas from the
 * shipped /shhhhh hero: untracked kicker (eyebrow-tracking A) and
 * word-boundary wrap only, no hyphens-auto (hero-hyphenation B).
 */
export default function ProductSplitHeroPreview() {
    return (
        <main className="bg-background-page">
            <section className="relative overflow-hidden bg-background-brand px-4 py-16 text-foreground-primary">
                <Image
                    src={Star}
                    alt=""
                    aria-hidden
                    className="pointer-events-none absolute top-[8%] left-[3%] z-10 w-10 md:top-[12%] md:left-[6%] md:w-14"
                />
                <Image
                    src={Star}
                    alt=""
                    aria-hidden
                    className="pointer-events-none absolute right-[4%] bottom-[5%] z-10 w-8 md:right-[8%] md:bottom-[8%] md:w-12"
                />
                <div className="relative z-20 mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 md:grid-cols-2">
                    <div className="min-w-0">
                        <h1>
                            {/* untracked kicker — the ruled delta from the shipped tracking-widest */}
                            <span className="font-roboto-flex-extrabold block text-body-s-semibold uppercase">
                                Peanut Card
                            </span>
                            {/* ruled LP title ramp (landing-title-sizes A): heading 60 mobile,
                                headingMedium 80 desktop — word-boundary wrap only, so no break-words */}
                            <span className="font-roboto-flex-extrabold mt-2 block text-heading font-extraBlack md:text-headingMedium">
                                SPEND ANYWHERE
                            </span>
                        </h1>
                        <p className="font-roboto-flex-extrabold mt-6 max-w-xl text-heading-s uppercase md:text-heading-m">
                            One product, one promise, one fold
                        </p>
                        <p className="font-roboto-flex mt-6 max-w-xl text-body-l">
                            Copy column left, product art right. A sub-LP leads with the one star feature it sells — the
                            key visual stays on the main LP.
                        </p>
                        <div className="mt-8 sm:inline-block">
                            <Button className="sm:w-auto sm:min-w-64 sm:px-10" variant="secondary" shadowSize="4">
                                Get started
                            </Button>
                        </div>
                    </div>
                    <div className="mx-auto w-full max-w-md">
                        <div className="-rotate-6">
                            <ScaledPixelatedCardFace />
                        </div>
                        <p className="font-roboto-flex mt-8 text-body-xs text-foreground-primary/70 md:text-body-s">
                            Legal fine print rides under the product art — the same slot /shhhhh established.
                        </p>
                    </div>
                </div>
            </section>
        </main>
    )
}
