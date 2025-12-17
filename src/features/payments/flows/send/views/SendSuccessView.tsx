'use client'

// success view for send flow
// matches existing DirectSuccessView UI pattern

import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import { Icon } from '@/components/Global/Icons/Icon'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import { useSendFlow } from '../useSendFlow'
import { formatAmount } from '@/utils/general.utils'
import { useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useHaptic } from 'use-haptic'
import Image from 'next/image'
import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'

export function SendSuccessView() {
    const router = useRouter()
    const { triggerHaptic } = useHaptic()
    const { amount, usdAmount, recipient, attachment, resetSendFlow } = useSendFlow()

    // trigger haptic on mount
    useEffect(() => {
        triggerHaptic()
    }, [triggerHaptic])

    // format display amount
    const displayAmount = useMemo(() => {
        return `$${formatAmount(usdAmount || amount)}`
    }, [amount, usdAmount])

    // handle done
    const handleDone = () => {
        resetSendFlow()
        router.push('/home')
    }

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            <SoundPlayer sound="success" />

            <div className="md:hidden">
                <NavHeader
                    icon="cancel"
                    onPrev={() => {
                        resetSendFlow()
                        router.push('/home')
                    }}
                />
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
                        <h1 className="text-sm font-normal text-grey-1">
                            You sent {recipient?.fullName || recipient?.username}
                        </h1>
                        <h2 className="text-2xl font-extrabold">{displayAmount}</h2>
                        {attachment.message && (
                            <p className="text-sm font-medium text-grey-1">for {attachment.message}</p>
                        )}
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
