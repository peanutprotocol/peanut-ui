'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import ProgressBar from '@/components/0_Bruddle/ProgressBar'
import { Icon } from '@/components/Global/Icons/Icon'
import { NAV_CIRCLE_BUTTON_CLASSES } from '@/components/Global/NavHeader/navHeader.consts'
import PeanutMascot from '@/components/Global/PeanutMascot'
import CenteredStatusCard from '@/components/Global/EmptyStates/CenteredStatusCard'
import type { MascotPose } from '@/components/Global/PeanutMascot/PeanutMascot.types'
import SetupFooter from '@/components/Setup/components/SetupFooter'
import SetupTitleBlock from '@/components/Setup/components/SetupTitleBlock'
import { confettiPresets } from '@/utils/confetti'
import { twMerge } from '@/utils/tw'
import { useVerifyShellHold } from '@/utils/verify-shell'
import { useInsetColor } from '../useInsetColor'
import { useKycControl } from '../analytics'

const SCREEN_HEIGHT = 'min-h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom))]'
// The setup flow's panel: px-6, the CTA on one baseline, tighter on short phones.
const PANEL =
    'flex min-h-0 flex-1 flex-col justify-between gap-8 bg-background-page px-6 pt-10 pb-6 compact:gap-6 compact:pt-6 compact:pb-4 short:gap-4 short:pt-4 short:pb-3'

function BackButton({ onBack, screenId }: { onBack: () => void; screenId?: string }) {
    const t = useTranslations('kyc.paperworkVerification')
    const controls = useKycControl(screenId, 'kyc_status')
    return (
        <Button
            variant="ghost"
            onClick={() => {
                controls.track('back', 'tap')
                onBack()
            }}
            className={NAV_CIRCLE_BUTTON_CLASSES}
            aria-label={t('back')}
            data-testid="verify-back"
        >
            <Icon name="chevron-up" size={20} className="-rotate-90" />
        </Button>
    )
}

/**
 * A question screen: back and "Step n of m" in a top bar that stays put over
 * the scrolling content, the content under it at the setup flow's full-screen
 * offset, and the footer on the setup CTA baseline.
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
    useVerifyShellHold()
    return (
        <div className={twMerge('flex w-full flex-col bg-background-page', SCREEN_HEIGHT)}>
            <div
                data-verify-top-bar
                className="sticky top-0 z-20 grid w-full shrink-0 grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-6 bg-background-page px-4 pt-4 pb-6"
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
    screenId,
    onBack,
    title,
    description,
    children,
    footer,
    statusTone,
}: {
    pose: MascotPose
    statusTone?: 'error' | 'success'
    /** the analytics id of the screen, for its Back */
    screenId?: string
    onBack?: () => void
    title: ReactNode
    description?: ReactNode
    children?: ReactNode
    footer: ReactNode
}) {
    useInsetColor(!statusTone)
    useVerifyShellHold()
    return (
        <div className={twMerge('flex w-full flex-col bg-background-page', SCREEN_HEIGHT)}>
            {onBack && (
                <div className="absolute top-4 z-20 px-4">
                    <BackButton onBack={onBack} screenId={screenId} />
                </div>
            )}
            {statusTone ? (
                <div className={PANEL}>
                    <div className="flex flex-1 flex-col justify-center">
                        <CenteredStatusCard title={title} description={description} tone={statusTone} pose={pose}>
                            {children}
                        </CenteredStatusCard>
                    </div>
                    {footer}
                </div>
            ) : (
                <>
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
                </>
            )}
        </div>
    )
}

/**
 * A full-white moment between steps: the mascot and the title centred, the
 * footer on the CTA baseline. `celebrate` fires the shared confetti once.
 */
export function VerifyCelebrationLayout({
    pose,
    screenId,
    onBack,
    title,
    description,
    celebrate = false,
    statusTone,
    children,
    footer,
}: {
    pose: MascotPose
    screenId?: string
    onBack?: () => void
    title: ReactNode
    description?: ReactNode
    celebrate?: boolean
    statusTone?: 'success'
    children?: ReactNode
    footer: ReactNode
}) {
    useInsetColor(false)
    const celebrated = useRef(false)
    useEffect(() => {
        if (!celebrate || celebrated.current) return
        celebrated.current = true
        confettiPresets.success()
    }, [celebrate])
    return (
        <div className={twMerge('relative flex w-full flex-col bg-background-page', SCREEN_HEIGHT)}>
            {onBack && (
                <div className="absolute top-4 left-4 z-20">
                    <BackButton onBack={onBack} screenId={screenId} />
                </div>
            )}
            <div className="flex min-h-0 flex-1 flex-col justify-between gap-8 px-6 pt-4 pb-6">
                <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                    {statusTone ? (
                        <CenteredStatusCard title={title} description={description} tone={statusTone} pose={pose}>
                            {children}
                        </CenteredStatusCard>
                    ) : (
                        <>
                            <PeanutMascot pose={pose} alt="" className="h-52 w-auto" />
                            <div className="flex max-w-80 flex-col gap-2">
                                <h1 className="text-heading-s text-foreground-primary">{title}</h1>
                                {description && (
                                    <p className="text-body-m leading-[1.625rem] text-foreground-secondary">
                                        {description}
                                    </p>
                                )}
                            </div>
                            {children}
                        </>
                    )}
                </div>
                {footer}
            </div>
        </div>
    )
}

export { SetupFooter as VerifyFooter }
