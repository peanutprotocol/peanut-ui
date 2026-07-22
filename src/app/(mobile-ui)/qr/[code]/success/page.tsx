'use client'

import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { Icon } from '@/components/Global/Icons/Icon'
import { confettiPresets } from '@/utils/confetti'
import { useRedirectQrStatus } from '@/hooks/useRedirectQrStatus'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import { useToast } from '@/components/0_Bruddle/Toast'
import { BASE_URL } from '@/constants/general.consts'

export default function RedirectQrSuccessPage() {
    const t = useTranslations('qrPay')
    const tCommon = useTranslations('common')
    const router = useRouter()
    const params = useParams()
    const searchParams = useSearchParams()
    const code = (params?.code as string) || searchParams.get('code') || ''
    const toast = useToast()

    // Fetch redirect QR details using shared hook
    const { data: redirectQrData, isLoading } = useRedirectQrStatus(code)

    const qrUrl = `${BASE_URL}/qr/${code}`

    // Trigger confetti on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            confettiPresets.success()
        }, 300)

        return () => clearTimeout(timer)
    }, [])

    if (isLoading || !redirectQrData) {
        return (
            <div className="flex min-h-[inherit] flex-col gap-8">
                <NavHeader title={t('claimSuccess.navTitle')} />
                <div className="flex h-full items-center justify-center">
                    <PeanutLoading />
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-[inherit] flex-col gap-8">
            <NavHeader title={t('claimSuccess.navTitle')} />
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                {/* Title */}
                <div className="space-y-1 text-center">
                    <h1 className="text-2xl font-extrabold">{t('claimSuccess.title')}</h1>
                    <p className="text-base text-grey-1">{t('claimSuccess.description')}</p>
                </div>

                {/* QR Code Display */}
                <div className="flex justify-center py-4">
                    <QRCodeWrapper url={qrUrl} />
                </div>

                {/* Sticker Info Card */}
                <Card className="border-2 border-secondary-1 bg-secondary-1/10 p-4">
                    <div className="flex gap-3">
                        <Icon name="star" size={20} className="flex-shrink-0 text-secondary-1" />
                        <div className="space-y-1">
                            <p className="text-sm font-bold">{t('claimSuccess.putItAnywhere')}</p>
                            <p className="text-xs text-grey-1">{t('claimSuccess.stickerDescription')}</p>
                        </div>
                    </div>
                </Card>

                {/* Action Buttons */}
                <div className="space-y-3">
                    <Button
                        variant="purple"
                        shadowSize="4"
                        onClick={() => router.push('/home')}
                        className="w-full"
                        icon="arrow-up-right"
                    >
                        {tCommon('goToHome')}
                    </Button>
                    <Button
                        variant="primary-soft"
                        shadowSize="4"
                        onClick={async () => {
                            try {
                                // ALWAYS copy to clipboard first (works on both desktop and mobile)
                                await navigator.clipboard.writeText(qrUrl)
                                toast.info(t('claimSuccess.linkCopied'))

                                // THEN try to open share dialog if available (bonus for mobile users)
                                if (navigator.share) {
                                    await navigator.share({
                                        title: t('claimSuccess.shareTitle'),
                                        text: t('claimSuccess.shareText'),
                                        url: qrUrl,
                                    })
                                }
                            } catch (error) {
                                // Ignore user cancellation
                                if (!(error instanceof Error) || error.name !== 'AbortError') {
                                    console.error('Share error:', error)
                                }
                            }
                        }}
                        className="w-full"
                        icon="share"
                    >
                        {t('claimSuccess.shareQr')}
                    </Button>
                </div>
            </div>
        </div>
    )
}
