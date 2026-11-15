'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import CenteredStatusCard from '@/components/Global/EmptyStates/CenteredStatusCard'
import NavHeader from '@/components/Global/NavHeader'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

export function QrClaimUnavailableView({
    shakeClass,
    alreadyClaimed,
}: {
    shakeClass: string
    alreadyClaimed: boolean
}) {
    const t = useTranslations('qrPay')
    const tCommon = useTranslations('common')
    const router = useRouter()

    return (
        <PageStack className={shakeClass}>
            <NavHeader title={t('claim.navTitle')} />
            <PageStack.Center className="gap-4">
                <CenteredStatusCard
                    title={t('claim.unavailableTitle')}
                    description={alreadyClaimed ? t('claim.alreadyClaimed') : t('claim.notAvailable')}
                />
                <Button variant="primary" shadowSize="4" onClick={() => router.push('/home')} className="w-full">
                    {tCommon('goToHome')}
                </Button>
            </PageStack.Center>
        </PageStack>
    )
}
