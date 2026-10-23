'use client'

import { type ReactNode, useLayoutEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import ProgressBar from '@/components/0_Bruddle/ProgressBar'
import { Icon } from '@/components/Global/Icons/Icon'
import { NAV_CIRCLE_BUTTON_CLASSES } from '@/components/Global/NavHeader/navHeader.consts'
import PeanutMascot from '@/components/Global/PeanutMascot'
import type { MascotPose } from '@/components/Global/PeanutMascot/PeanutMascot.types'
import SetupFooter from '@/components/Setup/components/SetupFooter'
import SetupTitleBlock from '@/components/Setup/components/SetupTitleBlock'
import { twMerge } from '@/utils/tw'

const SCREEN_HEIGHT = 'min-h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom))]'
// The setup flow's panel: px-6, the CTA on one baseline, tighter on short phones.
const PANEL =
    'flex min-h-0 flex-1 flex-col justify-between gap-8 bg-white px-6 pt-10 pb-6 compact:gap-6 compact:pt-6 compact:pb-4 short:gap-4 short:pt-4 short:pb-3'

/** Paints the status-bar strip the way the setup flow does: white over questions, blue over a hero. */
function useInsetColor(hero: boolean) {
    useLayoutEffect(() => {
        document.documentElement.style.setProperty(
            '--setup-hero-background',
            hero ? 'var(--color-background-setup-hero)' : 'var(--color-background-default)'
        )
        return () => {
            document.documentElement.style.removeProperty('--setup-hero-background')
        }
    }, [hero])
}

function BackButton({ onBack }: { onBack: () => void }) {
    const t = useTranslations('kyc.paperworkVerification')
    return (
        <Button
            variant="ghost"
            onClick={onBack}
            className={twMerge(NAV_CIRCLE_BUTTON_CLASSES, 'bg-white')}
            aria-label={t('back')}
            data-testid="verify-back"
        >
            <Icon name="chevron-up" size={20} className="-rotate-90" />
        </Button>
    )
}

/**
 * A question screen: back and "Step n of m" in a fixed top bar 16px under the
 * safe area, the content under it at the setup flow's full-screen offset, and
 * the footer on the setup CTA baseline.
 */
export function VerifyQuestionLayout({
    progress,
    onBack,
    children,
    footer,
}: {
    progress?: { current: number; total: number }
    onBack?: () => void
    children: ReactNode
    footer: ReactNode
}) {
    const t = useTranslations('kyc.paperworkVerification')
    useInsetColor(false)
    return (
        <div className={twMerge('flex w-full flex-col bg-white', SCREEN_HEIGHT)}>
            <div
                data-verify-top-bar
                className="fixed inset-x-0 top-[calc(var(--safe-top)_+_1rem)] z-20 mx-auto grid w-full max-w-md grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-6 px-4"
            >
                <div className="size-10">{onBack && <BackButton onBack={onBack} />}</div>
                {progress && (
                    <div
                        role="progressbar"
                        aria-label={t('progress', progress)}
                        aria-valuemin={0}
                        aria-valuemax={progress.total}
                        aria-valuenow={progress.current}
                    >
                        <ProgressBar
                            value={(progress.current / progress.total) * 100}
                            fillClassName="bg-foreground-primary"
                        />
                    </div>
                )}
                <span />
            </div>
            <div aria-hidden className="my-4 h-11 shrink-0" />
            <div className={PANEL}>
                <div className="flex flex-col gap-6 compact:gap-4">{children}</div>
                {footer}
            </div>
        </div>
    )
}

/** A hero screen: the setup flow's blue hero with a mascot pose, then the white panel. */
export function VerifyHeroLayout({
    pose,
    onBack,
    title,
    description,
    children,
    footer,
}: {
    pose: MascotPose
    onBack?: () => void
    title: ReactNode
    description?: ReactNode
    children?: ReactNode
    footer: ReactNode
}) {
    useInsetColor(true)
    return (
        <div className={twMerge('flex w-full flex-col bg-white', SCREEN_HEIGHT)}>
            {onBack && (
                <div className="absolute top-[calc(var(--safe-top)_+_1rem)] z-20 px-4">
                    <BackButton onBack={onBack} />
                </div>
            )}
            <div className="setup-hero-height setup-hero-background relative flex w-full shrink-0 items-center justify-center overflow-hidden px-4 md:h-[40dvh]">
                <div className="absolute inset-x-0 top-16 bottom-2 flex items-center justify-center">
                    <PeanutMascot pose={pose} className="relative h-full max-w-full" />
                </div>
            </div>
            <div className={PANEL}>
                <SetupTitleBlock title={title} description={description} />
                {children && <div className="flex flex-1 flex-col gap-4">{children}</div>}
                {footer}
            </div>
        </div>
    )
}

export { SetupFooter as VerifyFooter }
