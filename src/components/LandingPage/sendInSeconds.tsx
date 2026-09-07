import Image from 'next/image'
import exclamations from '@/assets/illustrations/exclamations.svg'
import Star from '@/assets/illustrations/star.svg'
import { CloudsCss } from './CloudsCss'
import { AnimateOnView } from '@/components/Global/AnimateOnView'
import { SendInSecondsBody } from './SendInSecondsBody'
import { getTranslations } from '@/i18n'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'
import { landingStrings } from './landingStrings'

const sendInSecondsClouds = [
    { top: '15%', width: 320, speed: '40s', direction: 'ltr' as const },
    { top: '40%', width: 200, speed: '34s', direction: 'rtl' as const },
    { top: '70%', width: 180, speed: '30s', direction: 'ltr' as const },
    { top: '80%', width: 320, speed: '46s', direction: 'rtl' as const },
]

const starConfigs = [
    {
        className: 'absolute right-10 top-10 md:right-1/4 md:top-20',
        width: 50,
        height: 50,
        delay: '0.2s',
        x: '5px',
        rotate: '45deg',
    },
    { className: 'absolute bottom-16 left-1/3', width: 40, height: 40, delay: '0.4s', x: '-5px', rotate: '-10deg' },
    {
        className: 'absolute bottom-20 left-[2rem] md:bottom-72 md:right-[14rem]',
        width: 50,
        height: 50,
        delay: '0.6s',
        x: '5px',
        rotate: '-22deg',
    },
    { className: 'absolute left-[20rem] top-72', width: 60, height: 60, delay: '0.8s', x: '-5px', rotate: '12deg' },
]

/**
 * @param subtext the same content-system line the hero prints under its CTA
 *   (`heroConfig.primaryCta.subtext`); the get-the-app lockup reuses it rather
 *   than inventing a second social-proof string. Passed down from
 *   LandingPageContent, which already holds it — reading it here would mean a
 *   second uncached readFileSync + frontmatter parse of the landing markdown on
 *   every render.
 */
export function SendInSeconds({ locale = DEFAULT_LOCALE, subtext }: { locale?: Locale; subtext?: string }) {
    const i18n = getTranslations(locale)

    return (
        <section id="send-in-seconds" className="relative overflow-hidden bg-secondary-1 px-4 py-16 text-n-1 md:py-32">
            <CloudsCss clouds={sendInSecondsClouds} />

            {starConfigs.map((config, i) => (
                <AnimateOnView
                    key={i}
                    className={config.className}
                    delay={config.delay}
                    x={config.x}
                    rotate={config.rotate}
                >
                    <Image src={Star} alt="" width={config.width} height={config.height} />
                </AnimateOnView>
            ))}

            {/* Exclamations */}
            <Image
                src={exclamations}
                alt="Exclamations"
                width={200}
                height={300}
                className="absolute top-1/3 right-72 hidden -translate-y-1/2 transform md:block"
            />

            {/* Main content */}
            <div className="relative mx-auto max-w-3xl text-center">
                <SendInSecondsBody
                    strings={landingStrings(i18n)}
                    subtext={subtext}
                    tagline={
                        <>
                            {i18n.landingSendTagline1}
                            <br />
                            {i18n.landingSendTagline2}
                        </>
                    }
                />
            </div>
        </section>
    )
}
