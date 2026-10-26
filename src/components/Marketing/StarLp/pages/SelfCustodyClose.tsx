import Sparkle from '@/assets/illustrations/sparkle.svg'
import { Band } from '@/components/Marketing/StarLp/Band'
import { KnerdTitle } from '@/components/Marketing/StarLp/KnerdTitle'
import { PopIn } from '@/components/Marketing/StarLp/PopIn'
import { StarLpCta } from '@/components/Marketing/StarLp/StarLpCta'
import { Wiggle } from '@/components/Marketing/StarLp/Wiggle'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'

/**
 * The closing fold, built from CloseFold's parts so the two sparkles sit on
 * the title's corners and never share a row with the body line. The sparkles
 * pop (0s, 0.2s), then the button lands last (0.35s), as in peanutsplit's
 * FinalCta. The second sparkle is the page's other wobble loop.
 */
export function SelfCustodyClose() {
    return (
        <Band ground="pink" align="center">
            <h2 className="relative inline-block">
                <PopIn
                    tilt={-12}
                    className="pointer-events-none absolute -top-6 -left-8 w-10 md:-top-8 md:-left-14 md:w-14"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={Sparkle.src} width={Sparkle.width} height={Sparkle.height} alt="" aria-hidden />
                </PopIn>
                <KnerdTitle text={'Only\nyours'} size="hero" />
                <PopIn
                    delay={0.2}
                    tilt={10}
                    className="pointer-events-none absolute -right-8 -bottom-2 w-8 md:-right-14 md:w-12"
                >
                    <Wiggle kind="wobble" delay={0.6}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={Sparkle.src} width={Sparkle.width} height={Sparkle.height} alt="" aria-hidden />
                    </Wiggle>
                </PopIn>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-body-l">No password. Just your passkey.</p>
            <PopIn delay={0.35} className="mx-auto mt-8 w-fit">
                <StarLpCta qrPlacement="close" href={STAR_LP_HREF.signup} ground="pink">
                    Create an account
                </StarLpCta>
            </PopIn>
        </Band>
    )
}
