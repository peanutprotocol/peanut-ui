'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Card } from '@/components/0_Bruddle/Card'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
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
                <Card className="gap-4 p-6">
                    <div className="flex items-center justify-center">
                        <IconBubble icon="cancel" color="red" size="m" />
                    </div>
                    <div className="space-y-2 text-center">
                        <h1 className="text-heading-s">{t('claim.unavailableTitle')}</h1>
                        <p className="text-body-m text-foreground-secondary">
                            {alreadyClaimed ? t('claim.alreadyClaimed') : t('claim.notAvailable')}
                        </p>
                    </div>
                </Card>
                <Button variant="primary" shadowSize="4" onClick={() => router.push('/home')} className="w-full">
                    {tCommon('goToHome')}
                </Button>
            </PageStack.Center>
        </PageStack>
    )
}
