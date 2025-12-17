'use client'

// shared success view for payment flows
// displays success state after payment completion

import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import { Icon } from '@/components/Global/Icons/Icon'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import { formatAmount } from '@/utils/general.utils'
import { useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useHaptic } from 'use-haptic'
import Image from 'next/image'
import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'

export type PaymentSuccessType = 'send' | 'contribute'

interface PaymentSuccessViewProps {
    type: PaymentSuccessType
    amount: string
    recipientName: string
    message?: string
    onReset: () => void
}

export function PaymentSuccessView({ type, amount, recipientName, message, onReset }: PaymentSuccessViewProps) {
    const router = useRouter()
    const { triggerHaptic } = useHaptic()

    // trigger haptic on mount
    useEffect(() => {
        triggerHaptic()
    }, [triggerHaptic])

    // format display amount
    const displayAmount = useMemo(() => {
        return `$${formatAmount(amount)}`
    }, [amount])

    // get title based on type
    const title = useMemo(() => {
        switch (type) {
            case 'send':
                return `You sent ${recipientName}`
            case 'contribute':
                return `You contributed to ${recipientName}'s pot`
            default:
                return `Payment to ${recipientName}`
        }
    }, [type, recipientName])

    // handle done
    const handleDone = () => {
        onReset()
        router.push('/home')
    }

    // handle close
    const handleClose = () => {
        onReset()
        router.push('/home')
    }

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            <SoundPlayer sound="success" />

            <div className="md:hidden">
                <NavHeader icon="cancel" onPrev={handleClose} />
            </div>

            <div className="relative z-10 my-auto flex h-full flex-col justify-center space-y-4">
                <Image
                    src={chillPeanutAnim.src}
                    alt="Peanut Mascot"
                    width={20}
                    height={20}
                    className="absolute -top-32 left-1/2 -z-10 h-60 w-60 -translate-x-1/2"
                />

                <Card className="flex items-center gap-3 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 min-w-12 items-center justify-center rounded-full bg-success-3 font-bold">
                            <Icon name="check" size={24} />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <h1 className="text-sm font-normal text-grey-1">{title}</h1>
                        <h2 className="text-2xl font-extrabold">{displayAmount}</h2>
                        {message && <p className="text-sm font-medium text-grey-1">for {message}</p>}
                    </div>
                </Card>

                <div className="w-full space-y-5">
                    <Button onClick={handleDone} shadowSize="4">
                        Back to home
                    </Button>
                </div>
            </div>
        </div>
    )
}
