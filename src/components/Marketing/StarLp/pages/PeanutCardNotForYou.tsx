import { MARKETING_BAND_PADDING } from '@/constants/layout.consts'
import { PopIn } from '@/components/Marketing/StarLp/PopIn'
import { marketingBase } from '@/i18n/app/messages.marketing'
import { PeanutCardRise } from './PeanutCardRise'

// /shhhhh §4's title class with the design.md 320 step-down (headingSmall below xs).
// The unlayered `.font-roboto-flex-extrabold.text-headingSmall` rule pins 36px
// leading at every width, so xs to md restates text-heading's own 46px.
const sectionTitleClass =
    'font-roboto-flex-extrabold text-headingSmall xs:text-heading xs:max-md:leading-(--text-heading--line-height)! uppercase md:text-headingMedium'

// `.font-roboto-flex` sets its leading to 100%, which beats text-body-l's 26px.
const bodyClass = 'font-roboto-flex text-body-l leading-(--text-body-l--line-height)! opacity-90'

// The /shhhhh copy in English: the rest of this page is not localized, so the
// fold must not switch to the visitor's app language after hydration.
const copy = marketingBase.shhhhh.notForYou

/**
 * "Probably not for you.": the /shhhhh §4 fold, verbatim copy and markup. The
 * title pops in, then the body follows in steps; the closing fold after it carries the CTA.
 */
export function PeanutCardNotForYou() {
    return (
        <section className={`relative overflow-hidden bg-gray-950 text-white ${MARKETING_BAND_PADDING}`}>
            <div className="mx-auto max-w-3xl">
                <PopIn>
                    <h2 className={sectionTitleClass}>{copy.title}</h2>
                </PopIn>
                <PeanutCardRise variant="rise" delay={0.1} className="mt-8">
                    <p className={bodyClass}>{copy.body1}</p>
                </PeanutCardRise>
                <PeanutCardRise variant="rule" delay={0.2} className="mt-4" />
                <PeanutCardRise variant="rise" delay={0.3} className="pt-4">
                    <p className={bodyClass}>{copy.body2}</p>
                </PeanutCardRise>
            </div>
        </section>
    )
}
