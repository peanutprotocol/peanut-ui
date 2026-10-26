import { Button } from '@/components/0_Bruddle/Button'
import Title from '@/components/0_Bruddle/Title'
import { CTA_MOTION } from '@/components/Marketing/constants'

/**
 * The closing fold on the hero composition: the opening 1–3 words stand as a
 * Title lockup on hand-placed lines, the rest of the headline sits under it
 * in the display ramp — the way TAP. SCAN. ANYWHERE. sits under LOCAL FEEL.
 * Never Knerd inline in a sentence, never hand-rolled knerd layers.
 * The CTA follows the CTA hierarchy: white secondary pill on the coloured band.
 */
export default function ClosingFoldPreview() {
    return (
        <main className="bg-background-page">
            <section className="bg-action-secondary px-4 py-16 text-center">
                <h2 className="flex flex-col items-center">
                    <Title
                        text={'SEND IN\nSECONDS.'}
                        className="text-headingSmall xs:text-heading md:text-headingMedium lg:text-headingLarge"
                    />
                    <span className="font-roboto-flex-extrabold mt-4 block text-headingSmall font-extraBlack text-foreground-primary uppercase md:mt-8 md:text-headingMedium">
                        PAY ZERO FEES.
                    </span>
                </h2>
                <p className="mx-auto mt-6 max-w-xl text-body-l text-foreground-primary">
                    The subline stays Roboto Flex — Knerd is only for the lockup above.
                </p>
                <div className="mx-auto mt-8 w-fit">
                    <Button size="large" variant="secondary" className={`w-fit ${CTA_MOTION}`}>
                        Get started
                    </Button>
                </div>
            </section>
        </main>
    )
}
