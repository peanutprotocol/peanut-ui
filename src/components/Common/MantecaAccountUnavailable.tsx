'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import NavHeader from '@/components/Global/NavHeader'
import CenteredErrorCard from '@/components/Global/EmptyStates/CenteredErrorCard'
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
                <CenteredErrorCard
                    title={tCommon('bankTransfersUnavailable')}
                    description={
                        <div role="alert">
                            {description ??
                                (country
                                    ? tErrors('mantecaAccountRejectedForCountry', { country })
                                    : tErrors('mantecaAccountRejected'))}
                        </div>
                    }
                >
                    <Button variant="primary" onClick={onSupport}>
                        {tCommon('contactSupport')}
                    </Button>
                </CenteredErrorCard>
            </PageStack.Center>
        </PageStack>
    )
}
