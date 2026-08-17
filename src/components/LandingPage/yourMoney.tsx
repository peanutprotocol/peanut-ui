import Image from 'next/image'
import LandingCountries from '@/assets/illustrations/landing-countries.svg'
import { Button } from '@/components/0_Bruddle/Button'
import { getTranslations } from '@/i18n'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'

export function YourMoney({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
    const i18n = getTranslations(locale)

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
                        {i18n.landingGlobalCashBody}
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
