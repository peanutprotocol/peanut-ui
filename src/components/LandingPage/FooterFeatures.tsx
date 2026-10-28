import Link from 'next/link'
import { getTranslations } from '@/i18n'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'
import { getStarLpLinks } from '@/components/Marketing/StarLp/starLpNavigation'

export function FooterFeatures({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
    const i18n = getTranslations(locale)

    return (
        <nav aria-label={i18n.footerFeatures} className="bg-black px-6 py-8 md:px-16">
            <h3 className="mb-3 text-label-m text-white">{i18n.footerFeatures}</h3>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-3">
                {getStarLpLinks(locale).map((link) => (
                    <li key={link.key}>
                        <Link
                            prefetch={false}
                            href={link.href}
                            hrefLang={link.hrefLang}
                            className="text-body-xs text-white underline underline-offset-2 [text-decoration-skip-ink:none] hover:text-foreground-inverse-secondary active:text-foreground-inverse-secondary"
                        >
                            {link.label}
                            {link.languageLabel && ` (${link.languageLabel})`}
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    )
}
