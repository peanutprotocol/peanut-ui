'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { NAV_CIRCLE_BUTTON_CLASSES } from '@/components/Global/NavHeader/navHeader.consts'
import { SetupLanguageSwitcher } from '@/components/Setup/components/SetupLanguageSwitcher'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { twMerge } from '@/utils/tw'
import { ProgressDots } from './ProgressDots'
import { CarouselDots } from '@/components/0_Bruddle/CarouselDots'
import { useEffect, useState } from 'react'

/**
 * Back on the left, the progress dots centred, the language on the right (mock shell.css .topbar). A hidden
 * control keeps its place, so nothing shifts between steps. It sits outside the sliding screens.
 */
export function ShellTopBar({
    showBack,
    onBack,
    progress,
    showLanguage,
    reduced,
}: {
    showBack: boolean
    onBack?: () => void
    progress: { index: number; total: number } | null
    showLanguage: boolean
    reduced: boolean
}) {
    const t = useTranslations('setup.navigation')
    const [variant, setVariant] = useState<string | null>(null)
    useEffect(() => {
        setVariant(new URLSearchParams(window.location.search).get('dots'))
    }, [])
    const { track } = useSignupControl()
    const fade = reduced ? 'transition-opacity duration-fast' : 'transition-opacity duration-fast ease-in-out'
    return (
        <div
            data-setup-top-bar
            className="absolute top-[var(--sr-topbar-top)] right-4 left-4 z-30 flex h-10 items-center justify-between"
        >
            <div className={twMerge('size-10 shrink-0', fade, !showBack && 'pointer-events-none opacity-0')}>
                {showBack && (
                    <Button
                        variant="ghost"
                        onClick={() => {
                            track('back', 'tap')
                            onBack?.()
                        }}
                        className={NAV_CIRCLE_BUTTON_CLASSES}
                        aria-label={t('goBack')}
                    >
                        <Icon name="chevron-up" size={20} className="-rotate-90" />
                    </Button>
                )}
            </div>
            <div className={twMerge('absolute left-1/2 -translate-x-1/2', fade, !progress && 'opacity-0')}>
                {progress &&
                    (variant === 'current' ? (
                        <CarouselDots
                            count={progress.total}
                            activeIndex={progress.index}
                            aria-label={`Step ${progress.index + 1} of ${progress.total}`}
                        />
                    ) : (
                        <ProgressDots index={progress.index} total={progress.total} reduced={reduced} />
                    ))}
            </div>
            <div
                className={twMerge('flex min-w-10 justify-end', fade, !showLanguage && 'pointer-events-none opacity-0')}
            >
                {showLanguage && <SetupLanguageSwitcher />}
            </div>
        </div>
    )
}
