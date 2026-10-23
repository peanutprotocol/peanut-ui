import { SEOFooter } from './SEOFooter'
import { FooterChrome } from './FooterChrome'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'
import { contentHrefsFor } from './landingContentHrefs.server'

const Footer = ({
    showSiteDirectory = true,
    showLocaleSwitcher = true,
    padForStickyCta = false,
    locale = DEFAULT_LOCALE,
}: {
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
            {showSiteDirectory && <SEOFooter locale={locale} padForStickyCta={padForStickyCta} />}
        </>
    )
}

export default Footer
