import Image from 'next/image'
import Link from 'next/link'
import LandingCountries from '@/assets/illustrations/landing-countries.svg'
import { Button } from '@/components/0_Bruddle/Button'
import { getTranslations } from '@/i18n'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'
import { linkTerms, type LinkedTerm } from './landingLinks.utils'

// The three cities named in landingGlobalCashBody, each pointing at its country
// page. Aliases cover every spelling the catalogs use, so the line stays one
// translated string per locale.
const cityTerms = (locale: Locale): LinkedTerm[] => [
    { aliases: ['New York', 'Nueva York', 'Nova York'], href: `/${locale}/united-states` },
    { aliases: ['Madrid', 'Madri'], href: `/${locale}/spain` },
    { aliases: ['Mexico City', 'Ciudad de México', 'Cidade do México'], href: `/${locale}/mexico` },
]

export function YourMoney({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
    const i18n = getTranslations(locale)
    const bodyParts = linkTerms(i18n.landingGlobalCashBody, cityTerms(locale))

    return (
        <section id="global-cash" className="bg-secondary-1 px-4 py-12 text-n-1 md:py-16">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-7 md:flex-row">
                <div className="space-y-6 mt-4 mb-12 w-full text-center md:mt-6 md:mb-20 md:w-1/2 md:text-left">
                    <h1 className="font-roboto-flex-extrabold text-6xl font-extraBlack md:text-6xl lg:text-headingMedium">
                        {i18n.landingGlobalCashLine1}
                        <br /> {i18n.landingGlobalCashLine2}
                    </h1>

                    <h2 className="font-roboto-flex text-lg md:text-4xl md:font-medium">
                        {i18n.landingGlobalCashStats}
                    </h2>

                    <p className="font-roboto-flex text-left text-xl font-light md:text-4xl md:font-normal">
                        {bodyParts.map((part, index) =>
                            part.href ? (
                                <Link key={index} href={part.href} className="underline-offset-4 hover:underline">
                                    {part.text}
                                </Link>
                            ) : (
                                part.text
                            )
                        )}
                    </p>
                </div>

                <div className="relative w-full md:w-1/2">
                    <Image src={LandingCountries} alt="countries" />
                    <a
                        href="/setup"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        <Button
                            shadowSize="4"
                            className="h-auto w-auto bg-white px-8 py-3 text-sm font-extrabold hover:bg-white/90 md:px-10 md:py-4 md:text-lg"
                        >
                            {i18n.landingSignUp}
                        </Button>
                    </a>
                </div>
            </div>
        </section>
    )
}
