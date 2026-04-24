'use client'
import { type FC, useState } from 'react'
import Image, { type StaticImageData } from 'next/image'
import { twMerge } from 'tailwind-merge'
import NavHeader from '@/components/Global/NavHeader'
import { Button } from '@/components/0_Bruddle/Button'
import { APPLE_WALLET_STEPS, GOOGLE_WALLET_STEPS } from '@/assets/cards'
import { useWalletPlatform, type WalletPlatform } from '@/hooks/useWalletPlatform'

interface Step {
    title: string
    image: StaticImageData
}

const STEPS_BY_PLATFORM: Record<Exclude<WalletPlatform, 'other'>, Step[]> = {
    ios: [
        { title: 'Open Wallet App', image: APPLE_WALLET_STEPS[0] },
        { title: 'Tap + in the top right', image: APPLE_WALLET_STEPS[1] },
        { title: 'Tap Debit or Credit Card', image: APPLE_WALLET_STEPS[2] },
        { title: 'Follow onscreen steps', image: APPLE_WALLET_STEPS[3] },
    ],
    android: [
        { title: 'Open Wallet App', image: GOOGLE_WALLET_STEPS[0] },
        { title: 'Tap + add to wallet', image: GOOGLE_WALLET_STEPS[1] },
        { title: 'Tap Payment card', image: GOOGLE_WALLET_STEPS[2] },
        { title: 'Follow onscreen steps', image: GOOGLE_WALLET_STEPS[3] },
    ],
}

interface Props {
    onDone: () => void
    onPrev?: () => void
}

const AddToWalletCarousel: FC<Props> = ({ onDone, onPrev }) => {
    const platform = useWalletPlatform()
    const platformLabel = platform === 'android' ? 'Google Wallet' : 'Apple Wallet'
    const steps: Step[] = STEPS_BY_PLATFORM[platform === 'android' ? 'android' : 'ios']
    const [index, setIndex] = useState(0)
    const isLast = index === steps.length - 1
    const step = steps[index]

    const onNext = () => {
        if (isLast) onDone()
        else setIndex((i) => i + 1)
    }

    return (
        <div className="flex min-h-[inherit] flex-col gap-6">
            <NavHeader title={platformLabel} onPrev={onPrev} />

            <div className="my-auto flex flex-col items-center gap-6 text-center">
                <div className="w-full max-w-xs overflow-hidden rounded-sm border border-n-1">
                    <Image src={step.image} alt="" aria-hidden className="h-auto w-full" priority />
                </div>

                <div className="text-xl font-extrabold">{step.title}</div>

                <div className="flex items-center gap-2" aria-label={`Step ${index + 1} of ${steps.length}`}>
                    {steps.map((_, i) => (
                        <span
                            key={i}
                            className={twMerge(
                                'h-2 w-2 rounded-full transition-colors',
                                i === index ? 'bg-primary-1' : 'bg-grey-4'
                            )}
                        />
                    ))}
                </div>

                <Button variant="purple" shadowSize="4" className="w-full" onClick={onNext}>
                    {isLast ? 'Done' : 'Next'}
                </Button>
            </div>
        </div>
    )
}

export default AddToWalletCarousel
