'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { useModalsContext } from '@/context/ModalsContext'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { PeanutCrying } from '@/assets/mascot'

type ClaimErrorViewProps = {
    title: string
    message: string
    primaryButtonText: string
    onPrimaryClick: () => void
}

export const ClaimErrorView = ({ title, message, primaryButtonText, onPrimaryClick }: ClaimErrorViewProps) => {
    const { openSupportWithMessage } = useModalsContext()
    const t = useTranslations('claim')

    return (
        <div className="flex flex-col items-center justify-center space-y-4 rounded-lg text-center">
            <Image src={PeanutCrying.src} unoptimized alt={t('errors.sadPeanutAlt')} width={96} height={96} />
            <div className="space-y-2">
                <h1 className="text-lg font-semibold">{title}</h1>
                <p className="text-sm font-normal md:max-w-xs">{message}</p>
            </div>
            <div className="flex w-full flex-col gap-2">
                <Button onClick={onPrimaryClick} size="medium" shadowSize="4" variant="purple" className="w-full">
                    {primaryButtonText}
                </Button>
                <Button
                    onClick={() => {
                        openSupportWithMessage(t('errors.supportPrefill', { url: window.location.href }))
                    }}
                    size="medium"
                    shadowSize="4"
                    variant="stroke"
                    className="w-full"
                >
                    {t('errors.talkToSupport')}
                </Button>
                <Link href="/home" className="mt-2 cursor-pointer text-sm text-grey-1 underline underline-offset-2">
                    {t('errors.goBackToHome')}
                </Link>
            </div>
        </div>
    )
}
