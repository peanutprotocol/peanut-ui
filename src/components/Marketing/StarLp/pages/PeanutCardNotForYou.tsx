import { MARKETING_BAND_PADDING } from '@/constants/layout.consts'
import { marketingBase } from '@/i18n/app/messages.marketing'

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
 * "Probably not for you.": the /shhhhh §4 fold, verbatim copy and markup, no
 * motion, no CTA (neither the mock nor /shhhhh has one here).
 * OPEN: Konrad's unsaved "shhh" comments on this fold, incl. whether it wants a closing CTA.
 */
export function PeanutCardNotForYou() {
    return (
        <section className={`relative overflow-hidden bg-gray-950 text-white ${MARKETING_BAND_PADDING}`}>
            <div className="mx-auto max-w-3xl">
                <h2 className={sectionTitleClass}>{copy.title}</h2>
                <p className={`mt-8 ${bodyClass}`}>{copy.body1}</p>
                <p className={`mt-4 border-t-2 border-white/25 pt-4 ${bodyClass}`}>{copy.body2}</p>
            </div>
        </section>
    )
}
