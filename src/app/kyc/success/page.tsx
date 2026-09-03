'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import HandThumbsUp from '@/assets/illustrations/hand-thumbs-up.svg'

/*
This page is just to let users know that their KYC was successful. Incase there's some issue with webosckets closing the modal, ideally this should not happen but added this as fallback guide
*/
export default function KycSuccessPage() {
    const t = useTranslations('kyc')
    useEffect(() => {
        if (window.parent) {
            window.parent.postMessage({ source: 'peanut-kyc-success' }, '*')
        }
    }, [])

    return (
        <div className="flex h-screen min-h-full w-full flex-col items-center justify-center gap-4">
            <Image src={HandThumbsUp} alt="Peanut HandThumbsUp" className="size-34" />
            <div className="space-y-2">
                <p className="text-heading-card">{t('successTitle')}</p>
                <p className="text-body-s text-foreground-secondary">{t('successCloseWindow')}</p>
            </div>
        </div>
    )
}
