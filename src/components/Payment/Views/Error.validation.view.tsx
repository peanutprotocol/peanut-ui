'use client'

import PEANUTMAN_CRY from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_05.gif'
import { Button } from '@/components/0_Bruddle'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useSupportModalContext } from '@/context/SupportModalContext'
import { useEffect, useState } from 'react'

export type ValidationErrorViewProps = {
    title: string | React.ReactNode
    message: string
    buttonText: string
    redirectTo: string
    showLearnMore?: boolean
    supportMessageTemplate?: string
}

function ValidationErrorView({
    title,
    message,
    buttonText,
    redirectTo,
    showLearnMore = true,
    supportMessageTemplate,
}: ValidationErrorViewProps) {
    const router = useRouter()
    const { openSupportWithMessage } = useSupportModalContext()
    const [currentUrl, setCurrentUrl] = useState('')

    useEffect(() => {
        setCurrentUrl(window.location.href)
    }, [])

    const handleSupportClick = () => {
        const message = supportMessageTemplate?.replace('{url}', currentUrl) || currentUrl
        openSupportWithMessage(message)
    }

    return (
        <div className="flex flex-col items-center justify-center space-y-4 rounded-lg text-center">
            <Image src={PEANUTMAN_CRY.src} alt="Sad peanut 😢" width={96} height={96} />
            <div className="space-y-2">
                <h1 className="text-lg font-semibold">{title}</h1>
                <p className="text-sm font-normal md:max-w-xs">{message}</p>
            </div>
            {showLearnMore && (
                <Link
                    href={'https://docs.peanut.me/how-to-use-peanut-links/request-peanut-links'}
                    className="text-sm underline"
                    target="_blank"
                >
                    Learn how to receive money through Peanut
                </Link>
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
                        Talk to support
                    </Button>
                )}
            </div>
        </div>
    )
}

export default ValidationErrorView
