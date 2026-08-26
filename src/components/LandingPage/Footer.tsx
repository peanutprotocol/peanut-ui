import { SEOFooter } from './SEOFooter'
import { FooterChrome } from './FooterChrome'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'
import { contentHrefsFor } from './landingContentHrefs.server'

const Footer = ({
    showSiteDirectory = true,
    locale = DEFAULT_LOCALE,
}: {
    showSiteDirectory?: boolean
    locale?: Locale
}) => {
    return (
        <>
            <FooterChrome locale={locale} securityDisclosureHref={contentHrefsFor(locale).securityDisclosure} />
            {showSiteDirectory && <SEOFooter locale={locale} />}
        </>
    )
}

export default Footer
