'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { useModalsContext } from '@/context/ModalsContext'
import Image from 'next/image'
import Link from 'next/link'
import PEANUTMAN_CRY from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_05.gif'

type ClaimErrorViewProps = {
    title: string
    message: string
    primaryButtonText: string
    onPrimaryClick: () => void
}

export const ClaimErrorView = ({ title, message, primaryButtonText, onPrimaryClick }: ClaimErrorViewProps) => {
    const { openSupportWithMessage } = useModalsContext()

    return (
        <div className="flex flex-col items-center justify-center space-y-4 rounded-lg text-center">
            <Image src={PEANUTMAN_CRY.src} alt="Sad peanut 😢" width={96} height={96} />
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
                        openSupportWithMessage(`I clicked on this link but got an error: ${window.location.href}`)
                    }}
                    size="medium"
                    shadowSize="4"
                    variant="stroke"
                    className="w-full"
                >
                    Talk to support
                </Button>
                <Link href="/home" className="mt-2 cursor-pointer text-sm text-grey-1 underline underline-offset-2">
                    Go back to home
                </Link>
            </div>
        </div>
    )
}
