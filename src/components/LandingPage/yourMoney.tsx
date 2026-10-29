import Image from 'next/image'
import LandingCountries from '@/assets/illustrations/landing-countries.svg'
import { CountriesSignUpCta } from './CountriesSignUpCta'
import { getTranslations } from '@/i18n'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'

export function YourMoney({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
    const i18n = getTranslations(locale)

    return (
        <section
            id="global-cash"
            className="bg-background-accent-yellow px-6 py-16 text-foreground-primary md:px-4 md:py-24"
        >
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 md:flex-row">
                <div className="space-y-6 mt-4 mb-12 w-full text-center md:mt-6 md:mb-20 md:w-1/2 md:text-left">
                    <h2 className="font-roboto-flex-extrabold text-headingSmall font-extraBlack xs:text-heading md:text-headingMedium">
                        {i18n.landingGlobalCashLine1}
                        <br /> {i18n.landingGlobalCashLine2}
                    </h2>

                    <h2 className="font-roboto-flex text-lg md:text-4xl md:font-medium">
                        {i18n.landingGlobalCashStats}
                    </h2>

                    <p className="font-roboto-flex text-left text-body-l md:text-4xl">{i18n.landingGlobalCashBody}</p>
                </div>

                <div className="relative w-full md:w-1/2">
                    <Image src={LandingCountries} alt="countries" />
                    <CountriesSignUpCta label={i18n.landingSignUp} />
                </div>
            </div>
        </section>
    )
}
