import { SEOFooter } from './SEOFooter'
import { FooterChrome } from './FooterChrome'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'
import { resolveContentHref } from '@/lib/content'
import { EN_LANDING_CONTENT_HREFS } from './landingContentHrefs'

const Footer = ({
    showSiteDirectory = true,
    locale = DEFAULT_LOCALE,
}: {
    showSiteDirectory?: boolean
    locale?: Locale
}) => {
    return (
        <>
            <FooterChrome
                locale={locale}
                securityDisclosureHref={resolveContentHref(EN_LANDING_CONTENT_HREFS.securityDisclosure, locale)}
            />
            {showSiteDirectory && <SEOFooter locale={locale} />}
        </>
    )
}

export default Footer
