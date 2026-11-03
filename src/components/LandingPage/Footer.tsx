import { SEOFooter } from './SEOFooter'
import { FooterChrome } from './FooterChrome'
import { FooterFeatures } from './FooterFeatures'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'
import { contentHrefsFor } from './landingContentHrefs.server'

const Footer = ({
    showSiteDirectory = true,
    showLocaleSwitcher = true,
    padForStickyCta = false,
    locale = DEFAULT_LOCALE,
}: {
    /** Card pages omit geographic navigation from both product and SEO directories. */
    showSiteDirectory?: boolean
    /** false drops the language picker. Card pages set it: its trigger and
        options carry flags and country-named labels (Rain §7/§11). */
    showLocaleSwitcher?: boolean
    padForStickyCta?: boolean
    locale?: Locale
}) => {
    return (
        <>
            <FooterChrome
                locale={locale}
                securityDisclosureHref={contentHrefsFor(locale).securityDisclosure}
                showLocaleSwitcher={showLocaleSwitcher}
            />
            <FooterFeatures locale={locale} showCountryLinks={showSiteDirectory} />
            {showSiteDirectory && <SEOFooter locale={locale} padForStickyCta={padForStickyCta} />}
        </>
    )
}

export default Footer
