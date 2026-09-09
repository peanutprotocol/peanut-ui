'use client'

import { PageStack } from '@/components/0_Bruddle/PageStack'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import { useTranslations } from 'next-intl'

export function QrClaimLoadingView({ shakeClass }: { shakeClass: string }) {
    const tLoading = useTranslations('loadingStates')

    return (
        <PageStack className={shakeClass}>
            <NavHeader title={tLoading('loading')} />
            <div className="my-auto flex h-full items-center justify-center">
                <Loading variant="mascot" />
            </div>
        </PageStack>
    )
}
