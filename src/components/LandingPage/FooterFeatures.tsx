import Link from 'next/link'
import { getTranslations } from '@/i18n'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'
import { getStarLpLinks, type StarLpKey } from '@/components/Marketing/StarLp/starLpNavigation'

const COUNTRY_NEUTRAL_FEATURE_KEYS = new Set<StarLpKey>(['requestLinks', 'selfCustody', 'peanutCard'])
const FEATURE_LINK_CLASS =
    'text-body-xs text-white underline underline-offset-2 [text-decoration-skip-ink:none] hover:text-foreground-inverse-secondary active:text-foreground-inverse-secondary'

export function FooterFeatures({
    locale = DEFAULT_LOCALE,
    showCountryLinks = true,
}: {
    locale?: Locale
    showCountryLinks?: boolean
}) {
    const i18n = getTranslations(locale)
    const features = getStarLpLinks(locale).filter(
        (link) => showCountryLinks || COUNTRY_NEUTRAL_FEATURE_KEYS.has(link.key)
    )
    const directoryHref = locale === DEFAULT_LOCALE ? '/lp#features' : `/${locale}#features`

    return (
        <nav id="features" aria-label={i18n.footerFeatures} className="bg-black px-6 py-8 md:px-16">
            <h3 className="mb-3 text-label-m text-white">{i18n.footerFeatures}</h3>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-3">
                {features.map((link) => (
                    <li key={link.key}>
                        <Link prefetch={false} href={link.href} hrefLang={link.hrefLang} className={FEATURE_LINK_CLASS}>
                            {link.label}
                            {link.languageLabel && ` (${link.languageLabel})`}
                        </Link>
                    </li>
                ))}
                {!showCountryLinks && (
                    <li>
                        <Link prefetch={false} href={directoryHref} hrefLang={locale} className={FEATURE_LINK_CLASS}>
                            {i18n.footerExploreFeatures}
                        </Link>
                    </li>
                )}
            </ul>
        </nav>
    )
}
