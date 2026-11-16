'use client'

import { AnimatePresence, useReducedMotion } from 'framer-motion'
import {
    type CSSProperties,
    type ReactNode,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react'
import { SignupScreenContext } from '@/features/setup/useSignupControl'
import type { ScreenId } from '@/components/Setup/Setup.types'
import { isCapacitor } from '@/utils/capacitor'
import { twMerge } from '@/utils/tw'
import { DESKTOP_QUERY } from './desktopHero.consts'
import { GROUND_VAR, STAGE_HEIGHT_VAR } from './shell.consts'
import { SEAM_S, STEP_S } from './shell.motion'
import type { SetupGround, SetupStageSize } from './shell.types'
import { SetupShellContext } from './SetupShellContext'
import { createShellStore } from './shellStore'
import { ShellFooter } from './ShellFooter'
import { ShellSlide } from './ShellSlide'
import { ShellTopBar } from './ShellTopBar'
import { SetupDesktopHero } from './SetupDesktopHero'
import { useNavLock } from './useNavLock'
import { useShellFit } from './useShellFit'

const subscribeDesktop = (onChange: () => void) => {
    const media = window.matchMedia(DESKTOP_QUERY)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
}
const isDesktop = () => window.matchMedia(DESKTOP_QUERY).matches
const serverIsDesktop = () => false

const STAGE_RANK: Record<SetupStageSize, number> = { compact: 0, std: 1, tall: 2, full: 3 }

/** The token behind a ground as a hex value: the native status bar takes a literal colour. */
const groundHex = (ground: SetupGround): string | null => {
    const token = GROUND_VAR[ground].slice('var('.length, -1)
    const color = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
    return /^#[\da-f]{6}$/i.test(color) ? color : null
}

export type SetupShellProps = {
    screenId: ScreenId
    /** The step component; it renders one SetupScreen. */
    children: ReactNode
    /** 1 forward, -1 back, 0 first paint. */
    direction?: number
    /** The page allows Back here (not locked, not registering). A screen can still hide it (`chrome.back`). */
    showBackButton?: boolean
    onBack?: () => void
    /** The dot row: the current dot and the dot count. Null hides it (landing, after sign-up completes). */
    progress?: { index: number; total: number } | null
}

/**
 * The redesigned sign-up frame: one screen at a time on a coloured stage over a white panel, a top bar, and a
 * fixed footer. A step slides the new stage in over the old one (500 ms) while the seam eases to the new stage
 * height (300 ms); the CTA never moves. Mock: mono _temp/signup-redesign/r2/scaffold (core/shell.js, MOTION.md).
 */
export function SetupShell({ screenId, children, direction = 0, showBackButton, onBack, progress }: SetupShellProps) {
    const reducedMotion = !!useReducedMotion()
    const [store] = useState(createShellStore)
    const screen = useSyncExternalStore(store.subscribe, store.get, () => null)
    const shellRef = useRef<HTMLDivElement>(null)
    const probeRef = useRef<HTMLDivElement>(null)
    const markLocked = useCallback((locked: boolean) => {
        if (locked) shellRef.current?.setAttribute('data-nav-locked', '')
        else shellRef.current?.removeAttribute('data-nav-locked')
    }, [])
    const navLock = useNavLock({ screenId, store, onChange: markLocked })
    const { onEntered, guard } = navLock
    const context = useMemo(() => ({ store, reducedMotion, onEntered }), [store, reducedMotion, onEntered])
    const back = useCallback(() => guard(() => onBack?.()), [guard, onBack])

    const stage = screen?.stage ?? 'std'
    const { onFooterTop } = useShellFit({ shellRef, probeRef, stage, screenId })
    const ground = screen?.ground
    // Shrinking, the seam rises at once; growing, it drops at the end of the step, after the old panel text has gone.
    const previousStage = useRef(stage)
    const seamDelay = STAGE_RANK[stage] > STAGE_RANK[previousStage.current] ? STEP_S - SEAM_S : 0
    useLayoutEffect(() => {
        previousStage.current = stage
    }, [stage])

    // The safe-area fill above the shell and the native status bar follow the ground.
    useLayoutEffect(() => {
        if (!ground) return
        document.documentElement.style.setProperty('--setup-hero-background', GROUND_VAR[ground])
        return () => {
            document.documentElement.style.removeProperty('--setup-hero-background')
        }
    }, [ground])
    useEffect(() => {
        if (!ground || !isCapacitor()) return
        const color = groundHex(ground)
        if (!color) return
        let cancelled = false
        void import('@capacitor/status-bar')
            .then(async ({ StatusBar }) => {
                if (!cancelled) await StatusBar.setBackgroundColor({ color })
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [ground])

    // Desktop keeps dev's split: dev's side hero beside the phone column. It mounts only on desktop, so phones never
    // load its art. Dev's full-page steps had no hero: the celebration (full stage) and the residence comparison.
    const desktop = useSyncExternalStore(subscribeDesktop, isDesktop, serverIsDesktop)
    const desktopHero = desktop && stage !== 'full' && !(screenId === 'residence' && stage === 'compact')
    // Dev's desktop download landing showed the headline, the store QR, both store buttons and Log in at once, with the
    // mascot in the side hero. Under the tall stage the QR block falls below the fold, so on desktop the web landing
    // (no footer) takes the compact stage and leaves its art to the side hero.
    const desktopDownload = desktop && screenId === 'landing' && screen?.footer === null

    const chrome = screen?.chrome ?? {}
    return (
        <SetupShellContext.Provider value={context}>
            <SignupScreenContext.Provider value={screenId}>
                <div
                    className="md:flex md:h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom))] md:flex-row"
                    data-setup-desktop-frame
                >
                    {desktopHero && (
                        <SetupDesktopHero screenId={screenId} direction={direction} reduced={reducedMotion} />
                    )}
                    <div className="md:min-w-0 md:flex-1 md:bg-background-default">
                        <div
                            ref={shellRef}
                            className={twMerge(
                                'signup-shell relative mx-auto h-[var(--sr-h)] w-full max-w-[480px] overflow-hidden bg-background-default',
                                desktopDownload && '[&_[data-setup-art-box]]:hidden'
                            )}
                            style={
                                desktopDownload
                                    ? ({ '--sr-stage-tall-base': 'var(--sr-stage-compact-base)' } as CSSProperties)
                                    : undefined
                            }
                            data-setup-shell
                            data-setup-screen={screenId}
                        >
                            {/* the unfolded stage height, for the fold check (useShellFit) */}
                            <div
                                ref={probeRef}
                                aria-hidden="true"
                                className="pointer-events-none invisible absolute top-0 left-0 w-0"
                                style={{ height: `var(--sr-stage-${stage}-base)` }}
                            />
                            <div className="absolute inset-0" data-setup-track>
                                {/* presenceAffectsLayout off: on, every shell render hands the screen a new presence value (framer-motion
                            11 memoizes it on Math.random()), the screen re-renders and writes the store, and the shell renders again. */}
                                <AnimatePresence
                                    initial={false}
                                    custom={direction}
                                    mode="sync"
                                    presenceAffectsLayout={false}
                                >
                                    <ShellSlide key={screenId} slideKey={screenId} direction={direction}>
                                        {children}
                                    </ShellSlide>
                                </AnimatePresence>
                                {/* One white sheet is the panel ground for both screens; it covers the stages below the seam. */}
                                <div
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] bg-background-default"
                                    style={{
                                        top: STAGE_HEIGHT_VAR[stage],
                                        transition: reducedMotion
                                            ? 'none'
                                            : `top ${SEAM_S}s var(--sr-ease-step) ${seamDelay}s`,
                                    }}
                                    data-setup-seam
                                />
                            </div>
                            <ShellTopBar
                                showBack={!!showBackButton && chrome.back !== false}
                                onBack={back}
                                progress={chrome.dots === false ? null : (progress ?? null)}
                                showLanguage={chrome.lang !== false}
                                reduced={reducedMotion}
                            />
                            <ShellFooter
                                spec={screen?.footer ?? null}
                                latest={store.latestFooter}
                                reduced={reducedMotion}
                                guard={guard}
                                onTop={onFooterTop}
                            />
                        </div>
                    </div>
                </div>
                {/* The home-bar inset under the shell continues what sits above it, as in the mock: the white panel, or the
                    ground on a full stage. Above AppShell's own inset cover (z-40), which follows the platform, not the screen. */}
                <div
                    aria-hidden="true"
                    className={twMerge(
                        'pointer-events-none fixed inset-x-0 bottom-0 z-[41] mx-auto h-safe-bottom max-w-[480px]',
                        // under the column, right of the hero's 7/12
                        desktopHero && 'left-[calc(100%*7/12)]'
                    )}
                    style={{
                        background: stage === 'full' && ground ? GROUND_VAR[ground] : 'var(--color-background-default)',
                    }}
                    data-setup-inset
                />
            </SignupScreenContext.Provider>
        </SetupShellContext.Provider>
    )
}
