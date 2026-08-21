import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

/**
 * Copy + CTA for a terminal rejection caused by the document's jurisdiction.
 *
 * Shared by the drawer state and the modal so the two can never drift into
 * telling the same user different things. Three rules hold everywhere this
 * renders, and each is load-bearing:
 *
 *   1. NO retry. The document's country is unacceptable, not the document, so
 *      "try again" is a promise we know we cannot keep.
 *   2. NO contact-support CTA. Support cannot lift a jurisdictional block; the
 *      ticket only costs the user their time and ours.
 *   3. NO country named. The restricted set lives in the Sumsub dashboard, and
 *      the string says "your country" — so compliance can change the list
 *      without a copy change, a re-translation, or a deploy.
 *
 * What is left is the one useful thing: tell them plainly, and hand them the
 * part of the app that still works.
 */

/** Where the CTA sends them — the capability they keep. */
export const REGION_RESTRICTED_CTA_HREF = '/send'

export const useRegionRestrictedCta = (onNavigate?: () => void) => {
    const t = useTranslations('kyc.regionRestricted')
    const router = useRouter()

    const onClick = useCallback(() => {
        onNavigate?.()
        router.push(REGION_RESTRICTED_CTA_HREF)
    }, [onNavigate, router])

    return { label: t('cta'), onClick }
}

export const KycRegionRestrictedContent = () => {
    const t = useTranslations('kyc.regionRestricted')

    return (
        <div className="space-y-3 text-center">
            <p className="text-sm text-grey-1">{t('description')}</p>
            <p className="text-sm text-grey-1">{t('stillAvailable')}</p>
        </div>
    )
}
