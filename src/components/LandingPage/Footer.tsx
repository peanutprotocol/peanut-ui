import { SEOFooter } from './SEOFooter'
import { FooterChrome } from './FooterChrome'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'
import { contentHrefsFor } from './landingContentHrefs.server'

const Footer = ({
    showSiteDirectory = true,
    showGetTheApp = false,
    locale = DEFAULT_LOCALE,
}: {
    showSiteDirectory?: boolean
    /** pwa-sunset download block above the footer chrome — landing page only. */
    showGetTheApp?: boolean
    locale?: Locale
}) => {
    return (
        <>
            <FooterChrome
                locale={locale}
                securityDisclosureHref={contentHrefsFor(locale).securityDisclosure}
                showGetTheApp={showGetTheApp}
            />
            {showSiteDirectory && <SEOFooter locale={locale} />}
        </>
    )
}

export default Footer
