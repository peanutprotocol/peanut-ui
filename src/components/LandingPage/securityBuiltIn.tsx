import Image, { type StaticImageData } from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/0_Bruddle/Button'
import handThumbsUp from '@/assets/illustrations/hand-thumbs-up.svg'
import handWaving from '@/assets/illustrations/hand-waving.svg'
import handPeace from '@/assets/illustrations/hand-peace.svg'
import biometricProtection from '@/assets/illustrations/biometric-protection.svg'
import selfCustodialDesign from '@/assets/illustrations/self-custodial-design.svg'
import kycOnlyWhenRequired from '@/assets/illustrations/kyc-only-when-required.svg'
import { getTranslations } from '@/i18n'
import { DEFAULT_LOCALE, type Locale, type Translations } from '@/i18n/types'
import { EN_LANDING_CONTENT_HREFS, type LandingContentHrefs } from './landingContentHrefs'

interface Feature {
    id: number
    title: string
    titleSvg: StaticImageData
    description: string
    iconSrc: StaticImageData
    iconAlt: string
    learnMoreHref?: string
}

function buildFeatures(i18n: Translations, contentHrefs: LandingContentHrefs): Feature[] {
    return [
        {
            id: 1,
            title: i18n.landingSecurityTotalTitle,
            titleSvg: biometricProtection,
            description: i18n.landingSecurityTotalDesc,
            iconSrc: handThumbsUp,
            iconAlt: 'Thumbs up',
            learnMoreHref: contentHrefs.passkeys,
        },
        {
            id: 2,
            title: i18n.landingSecurityControlTitle,
            titleSvg: selfCustodialDesign,
            description: i18n.landingSecurityControlDesc,
            iconSrc: handWaving,
            iconAlt: 'Hand waving',
            learnMoreHref: contentHrefs.verification,
        },
        {
            id: 3,
            title: i18n.landingSecurityHelpTitle,
            titleSvg: kycOnlyWhenRequired,
            description: i18n.landingSecurityHelpDesc,
            iconSrc: handPeace,
            iconAlt: 'Peace sign',
        },
    ]
}

export function SecurityBuiltIn({
    locale = DEFAULT_LOCALE,
    contentHrefs = EN_LANDING_CONTENT_HREFS,
}: {
    locale?: Locale
    contentHrefs?: LandingContentHrefs
}) {
    const i18n = getTranslations(locale)
    const features = buildFeatures(i18n, contentHrefs)

    return (
        <section id="security" className="bg-primary-1 px-4 py-16 text-n-1 md:py-40">
            <div className="mx-auto max-w-7xl">
                <div className="mb-12 text-center md:mb-16 md:text-left">
                    {/* h2, not h1: this h1 sat directly above the h3 feature
                        titles, and that h1 → h3 skip failed Lighthouse's
                        heading-order audit. */}
                    <h2 className="font-roboto-flex-extrabold text-left text-heading font-extraBlack md:text-6xl lg:text-heading">
                        {i18n.landingSecurityHeading}
                    </h2>
                </div>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                    {features.map((feature) => (
                        <div
                            key={feature.id}
                            className="my-2 flex flex-col items-start text-center md:my-0 md:text-left"
                        >
                            <div className="mb-4">
                                <div className="flex h-10 w-10 items-center justify-center md:h-12 md:w-12">
                                    <Image
                                        src={feature.iconSrc}
                                        alt={feature.iconAlt}
                                        width={40}
                                        height={40}
                                        className="max-h-full max-w-full object-contain md:h-12 md:w-12"
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="mb-4 w-full text-left md:text-left">
                                    <h3 className="font-roboto-flex-extrabold text-2xl lg:text-3xl">{feature.title}</h3>
                                </div>
                                <p
                                    className="font-roboto-flex w-full max-w-[360px] text-left text-lg font-normal leading-relaxed md:text-xl"
                                    style={{ letterSpacing: '-0.5px' }}
                                >
                                    {feature.description}
                                </p>
                                {feature.learnMoreHref && (
                                    // max-w matches the paragraph above, so the link
                                    // lands on that right edge instead of the wider cell
                                    <p className="mt-4 w-full max-w-[360px] text-right">
                                        <a
                                            href={feature.learnMoreHref}
                                            className="font-roboto-flex text-base text-n-1 underline hover:no-underline md:text-lg"
                                        >
                                            {i18n.landingLearnMore} →
                                        </a>
                                    </p>
                                )}
                                {feature.id === 3 && (
                                    <div className="mt-6">
                                        <Link href="/support">
                                            <Button
                                                shadowSize="4"
                                                className="bg-white px-6 py-3 text-base font-extrabold text-n-1 hover:bg-white/90"
                                            >
                                                {i18n.landingTalkToSupport}
                                            </Button>
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
