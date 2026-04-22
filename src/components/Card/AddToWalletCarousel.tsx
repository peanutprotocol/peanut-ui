'use client'
import { type FC, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import NavHeader from '@/components/Global/NavHeader'
import { Button } from '@/components/0_Bruddle/Button'
import { useWalletPlatform, type WalletPlatform } from '@/hooks/useWalletPlatform'

interface Step {
    title: string
}

const STEPS_BY_PLATFORM: Record<Exclude<WalletPlatform, 'other'>, Step[]> = {
    ios: [
        { title: 'Open Wallet App' },
        { title: 'Tap + in the top right' },
        { title: 'Tap Debit or Credit Card' },
        { title: 'Follow onscreen steps' },
    ],
    android: [
        { title: 'Open Wallet App' },
        { title: 'Tap + add to wallet' },
        { title: 'Tap Payment card' },
        { title: 'Follow onscreen steps' },
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

    const onNext = () => {
        if (isLast) onDone()
        else setIndex((i) => i + 1)
    }

    return (
        <div className="flex min-h-[inherit] flex-col gap-6">
            <NavHeader title={platformLabel} onPrev={onPrev} />

            <div className="my-auto flex flex-col items-center gap-6 text-center">
                {/* Screenshot placeholder — swap for exported assets from Figma later. */}
                <div className="flex h-52 w-full max-w-xs items-center justify-center rounded-sm border border-n-1 bg-primary-3">
                    <span className="text-sm text-grey-1">Step {index + 1} preview</span>
                </div>

                <div className="text-xl font-extrabold">{steps[index].title}</div>

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
