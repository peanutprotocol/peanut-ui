'use client'

import { Callout } from '@/components/0_Bruddle/Callout'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import NavHeader from '@/components/Global/NavHeader'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { MASCOT_STATE_CLASS } from '@/components/Global/PeanutMascot/PeanutMascot.consts'
import { localizedCountryName } from '@/utils/country-name.utils'
import { useLocale, useTranslations } from 'next-intl'

export function MantecaAccountUnavailable({
    title,
    onBack,
    onSupport,
    description,
    countryCode,
}: {
    title: string
    onBack: () => void
    onSupport: () => void
    description?: string
    countryCode?: string
}) {
    const tErrors = useTranslations('errors')
    const tCommon = useTranslations('common')
    const locale = useLocale()
    const country = localizedCountryName(locale, countryCode, '')

    return (
        <PageStack>
            <NavHeader title={title} onPrev={onBack} />
            <PageStack.Center>
                <PeanutMascot pose="sad" className={`mx-auto ${MASCOT_STATE_CLASS}`} />
                <Callout priority="error" ctas={[{ label: tCommon('contactSupport'), onClick: onSupport }]}>
                    {description ??
                        (country
                            ? tErrors('mantecaAccountRejectedForCountry', { country })
                            : tErrors('mantecaAccountRejected'))}
                </Callout>
            </PageStack.Center>
        </PageStack>
    )
}
