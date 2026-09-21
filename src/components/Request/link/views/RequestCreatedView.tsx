'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import NavHeader from '@/components/Global/NavHeader'
import PeanutMascot from '@/components/Global/PeanutMascot'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import ShareButton from '@/components/Global/ShareButton'
import { shootDoubleStarConfetti } from '@/utils/confetti'
import { RequestFulfillmentNotice } from './RequestFulfillmentNotice'

interface RequestCreatedViewProps {
    requestId: string
    generatedLink: string
    requestAmount: string
    currency: string
    bankPayable: boolean
    onDone: () => void
    onCreateAnother: () => void
}

export function RequestCreatedView({
    requestId,
    generatedLink,
    requestAmount,
    currency,
    bankPayable,
    onDone,
    onCreateAnother,
}: RequestCreatedViewProps) {
    const t = useTranslations('request')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const celebrated = useRef(false)

    useEffect(() => {
        if (celebrated.current) return
        celebrated.current = true
        shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.4 } })
    }, [])

    const shareLabel =
        parseFloat(requestAmount) > 0
            ? currency === 'USD'
                ? t('shareAmountRequest', { amount: requestAmount })
                : t('shareCurrencyAmountRequest', { amount: requestAmount, currency })
            : t('shareOpenRequest')

    return (
        <PageStack>
            <NavHeader hideBackBtn title={tNav('request')} />
            <PageStack.Center className="gap-4 text-center md:my-0">
                <div className="flex flex-col items-center gap-4">
                    <PeanutMascot pose="cheering" alt="" className="size-[160px]" />
                    <TitleBlock size="s" title={<h1>{t('created.title')}</h1>} description={t('created.description')} />
                </div>

                <QRCodeWrapper url={generatedLink} />

                <RequestFulfillmentNotice requestId={requestId} bankPayable={bankPayable} />
            </PageStack.Center>

            <PageStack.Footer className="gap-3">
                <ShareButton url={generatedLink} variant="stroke">
                    {shareLabel}
                </ShareButton>
                <Button variant="transparent" className="w-full" onClick={onCreateAnother}>
                    {t('created.createAnother')}
                </Button>
                <Button variant="primary" className="w-full" onClick={onDone}>
                    {tCommon('done')}
                </Button>
            </PageStack.Footer>
        </PageStack>
    )
}
