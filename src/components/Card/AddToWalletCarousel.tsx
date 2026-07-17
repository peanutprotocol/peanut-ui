'use client'
import { type FC, type PointerEvent as ReactPointerEvent, useRef, useState } from 'react'
import Image, { type StaticImageData } from 'next/image'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import NavHeader from '@/components/Global/NavHeader'
import { Button } from '@/components/0_Bruddle/Button'
import { APPLE_WALLET_STEPS, GOOGLE_WALLET_STEPS } from '@/assets/cards'
import { useWalletPlatform, type WalletPlatform } from '@/hooks/useWalletPlatform'

// Pixel threshold for treating a pointer drag as a swipe. Smaller values
// feel jumpy on desktop trackpads; larger values miss short mobile flicks.
const SWIPE_THRESHOLD_PX = 50

type StepTitleKey = `addToWallet.${'ios' | 'android'}Step${1 | 2 | 3 | 4}`

interface Step {
    titleKey: StepTitleKey
    image: StaticImageData
}

const STEPS_BY_PLATFORM: Record<Exclude<WalletPlatform, 'other'>, Step[]> = {
    ios: [
        { titleKey: 'addToWallet.iosStep1', image: APPLE_WALLET_STEPS[0] },
        { titleKey: 'addToWallet.iosStep2', image: APPLE_WALLET_STEPS[1] },
        { titleKey: 'addToWallet.iosStep3', image: APPLE_WALLET_STEPS[2] },
        { titleKey: 'addToWallet.iosStep4', image: APPLE_WALLET_STEPS[3] },
    ],
    android: [
        { titleKey: 'addToWallet.androidStep1', image: GOOGLE_WALLET_STEPS[0] },
        { titleKey: 'addToWallet.androidStep2', image: GOOGLE_WALLET_STEPS[1] },
        { titleKey: 'addToWallet.androidStep3', image: GOOGLE_WALLET_STEPS[2] },
        { titleKey: 'addToWallet.androidStep4', image: GOOGLE_WALLET_STEPS[3] },
    ],
}

interface Props {
    onDone: () => void
    onPrev?: () => void
}

const AddToWalletCarousel: FC<Props> = ({ onDone, onPrev }) => {
    const t = useTranslations('card')
    const tCommon = useTranslations('common')
    const platform = useWalletPlatform()
    const platformLabel = platform === 'android' ? t('addToWallet.googleWallet') : t('addToWallet.appleWallet')
    const steps: Step[] = STEPS_BY_PLATFORM[platform === 'android' ? 'android' : 'ios']
    const [index, setIndex] = useState(0)
    const isLast = index === steps.length - 1
    const isFirst = index === 0
    const step = steps[index]

    const onNext = () => {
        if (isLast) onDone()
        else setIndex((i) => i + 1)
    }

    // Swipe gestures on the step body. Pointer events cover mouse + touch +
    // pen in one handler. We only act on the final delta in `onPointerUp`
    // (vs reacting on every move), so vertical scroll inside the container
    // is unaffected — the threshold check filters incidental drags.
    const pointerStartXRef = useRef<number | null>(null)
    const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
        pointerStartXRef.current = e.clientX
    }
    const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
        const startX = pointerStartXRef.current
        pointerStartXRef.current = null
        if (startX == null) return
        const deltaX = e.clientX - startX
        if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return
        if (deltaX < 0) {
            // Swipe left → next step. Don't auto-fire onDone on the last step
            // via swipe — keeps a deliberate confirmation tap on the CTA so
            // the user doesn't accidentally exit the carousel.
            if (!isLast) setIndex((i) => i + 1)
        } else if (!isFirst) {
            setIndex((i) => i - 1)
        }
    }

    return (
        <div className="flex min-h-[inherit] flex-col gap-6">
            <NavHeader title={platformLabel} onPrev={onPrev} />

            <div className="my-auto flex flex-col items-center gap-6 text-center">
                {/* touch-pan-y lets vertical scrolling still work while
                    horizontal pan is captured for swipe. */}
                <div
                    className="flex w-full touch-pan-y flex-col items-center gap-6"
                    onPointerDown={onPointerDown}
                    onPointerUp={onPointerUp}
                    onPointerCancel={() => {
                        pointerStartXRef.current = null
                    }}
                >
                    <div className="w-full max-w-xs overflow-hidden rounded-sm border border-n-1">
                        <Image src={step.image} alt="" aria-hidden className="h-auto w-full" priority />
                    </div>

                    <div className="text-xl font-extrabold">{t(step.titleKey)}</div>

                    <div
                        className="flex items-center gap-2"
                        aria-label={t('addToWallet.stepIndicator', { current: index + 1, total: steps.length })}
                    >
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
                </div>

                <Button variant="purple" shadowSize="4" className="w-full" onClick={onNext}>
                    {isLast ? tCommon('done') : tCommon('next')}
                </Button>
            </div>
        </div>
    )
}

export default AddToWalletCarousel
