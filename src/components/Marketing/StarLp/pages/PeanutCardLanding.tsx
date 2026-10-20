import { Band } from '@/components/Marketing/StarLp/Band'
import { DisplayLine } from '@/components/Marketing/StarLp/DisplayLine'
import { DropIn } from '@/components/Marketing/StarLp/DropIn'
import { KnerdTitle } from '@/components/Marketing/StarLp/KnerdTitle'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { StarLpHero } from '@/components/Marketing/StarLp/StarLpHero'
import { PeanutCardCta } from './PeanutCardCta'
import { PeanutCardHeroFace } from './PeanutCardHeroFace'
import { PeanutCardReceipt } from './PeanutCardReceipt'
import { PeanutCardNotForYou } from './PeanutCardNotForYou'

/**
 * /peanut-card: three folds, as approved (r4-peanut-card-final). No trust line,
 * no countries: Rain rules bar both on card pages. The hero holds the only CTA,
 * as in the mock.
 */
export function PeanutCardLanding() {
    return (
        <>
            <StarLpHero
                title={
                    <>
                        <DisplayLine>Visa Platinum</DisplayLine>
                        <DisplayLine>Dollar card</DisplayLine>
                        <KnerdTitle text="In pink" size="hero" className="mt-6 md:mt-8" />
                    </>
                }
                subtitle="Add your Peanut Card to Apple Pay or Google Pay where available in your region, then tap."
                art={
                    <DropIn fromTilt={-24} tilt={-7} className="mx-auto w-full max-w-sm px-2 md:max-w-md">
                        <PeanutCardHeroFace />
                    </DropIn>
                }
                cta={<PeanutCardCta />}
            />

            <Band ground="cream">
                {/* Phones: title, drawings, rate line. md+: title over the line on
                    the left, drawings on the right. */}
                <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-x-12">
                    <SectionTitle className="md:col-start-1 md:row-start-1 md:self-end">
                        Tap. Here&apos;s the receipt.
                    </SectionTitle>
                    <div className="md:col-start-2 md:row-span-2 md:row-start-1">
                        <PeanutCardReceipt />
                    </div>
                    <p className="text-center text-body-l md:col-start-1 md:row-start-2 md:self-start md:text-left">
                        Other currencies: Visa rate + 1% Visa fee.
                        <br />
                        Verification and approval required.
                    </p>
                </div>
            </Band>

            <PeanutCardNotForYou />
        </>
    )
}
