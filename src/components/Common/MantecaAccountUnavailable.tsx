'use client'

import { Callout } from '@/components/0_Bruddle/Callout'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import NavHeader from '@/components/Global/NavHeader'
import { useTranslations } from 'next-intl'

export function MantecaAccountUnavailable({
    title,
    onBack,
    onSupport,
    description,
}: {
    title: string
    onBack: () => void
    onSupport: () => void
    description?: string
}) {
    const tErrors = useTranslations('errors')
    const tCommon = useTranslations('common')

    return (
        <PageStack>
            <NavHeader title={title} onPrev={onBack} />
            <PageStack.Center>
                <Callout priority="error" ctas={[{ label: tCommon('contactSupport'), onClick: onSupport }]}>
                    {description ?? tErrors('mantecaAccountRejected')}
                </Callout>
            </PageStack.Center>
        </PageStack>
    )
}
