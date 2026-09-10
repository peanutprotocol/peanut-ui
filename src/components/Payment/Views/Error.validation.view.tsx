'use client'

import { PeanutSad } from '@/assets/mascot'
import { Button } from '@/components/0_Bruddle/Button'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useModalsContext } from '@/context/ModalsContext'
import { useEffect, useState } from 'react'
import DocsLink from '@/components/Global/DocsLink'

export type ValidationErrorViewProps = {
    title: string | React.ReactNode
    message: string
    buttonText: string
    redirectTo: string
    showLearnMore?: boolean
    supportMessageTemplate?: string
    supportButtonText?: string
}

function ValidationErrorView({
    title,
    message,
    buttonText,
    redirectTo,
    showLearnMore = true,
    supportMessageTemplate,
    supportButtonText,
}: ValidationErrorViewProps) {
    const t = useTranslations('payment')
    const router = useRouter()
    const { openSupportWithMessage } = useModalsContext()
    const [currentUrl, setCurrentUrl] = useState('')

    useEffect(() => {
        setCurrentUrl(window.location.href)
    }, [])

    const handleSupportClick = () => {
        const message = supportMessageTemplate?.replace('{url}', currentUrl) || currentUrl
        openSupportWithMessage(message)
    }

    return (
        <div className="space-y-4 flex flex-col items-center justify-center text-center">
            <Image src={PeanutSad.src} unoptimized alt={t('validation.sadPeanutAlt')} width={96} height={96} />
            <div className="space-y-2">
                <h1 className="text-heading-card">{title}</h1>
                <p className="text-body-s font-normal md:max-w-xs">{message}</p>
            </div>
            {showLearnMore && (
                <DocsLink href="/en/help/request-money" className="text-body-s underline">
                    {t('validation.learnHow')}
                </DocsLink>
            )}
            <div className="flex w-full flex-col gap-2">
                <Button
                    onClick={() => {
                        router.push(redirectTo)
                    }}
                    size="medium"
                    shadowSize="4"
                    variant="purple"
                    className="w-full"
                >
                    {buttonText}
                </Button>
                {supportMessageTemplate && (
                    <Button
                        onClick={handleSupportClick}
                        size="medium"
                        shadowSize="4"
                        variant="stroke"
                        className="w-full"
                    >
                        {supportButtonText ?? t('validation.talkToSupport')}
                    </Button>
                )}
            </div>
        </div>
    )
}

export default ValidationErrorView
