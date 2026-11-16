'use client'

import { AnimatePresence, useReducedMotion } from 'framer-motion'
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { SignupScreenContext } from '@/features/setup/useSignupControl'
import type { ScreenId } from '@/components/Setup/Setup.types'
import { isCapacitor } from '@/utils/capacitor'
import { GROUND_VAR, STAGE_HEIGHT_VAR } from './shell.consts'
import { SEAM_S, STEP_S } from './shell.motion'
import type { SetupGround, SetupStageSize } from './shell.types'
import { SetupShellContext } from './SetupShellContext'
import { createShellStore } from './shellStore'
import { ShellFooter } from './ShellFooter'
import { ShellSlide } from './ShellSlide'
import { ShellTopBar } from './ShellTopBar'

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
    const context = useMemo(() => ({ store, reducedMotion }), [store, reducedMotion])

    const stage = screen?.stage ?? 'std'
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

    const chrome = screen?.chrome ?? {}
    return (
        <SetupShellContext.Provider value={context}>
            <SignupScreenContext.Provider value={screenId}>
                <div
                    className="signup-shell relative mx-auto h-[var(--sr-h)] w-full max-w-[480px] overflow-hidden bg-background-default"
                    data-setup-shell
                    data-setup-screen={screenId}
                >
                    <div className="absolute inset-0" data-setup-track>
                        <AnimatePresence initial={false} custom={direction} mode="sync">
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
                                transition: reducedMotion ? 'none' : `top ${SEAM_S}s var(--sr-ease-step) ${seamDelay}s`,
                            }}
                            data-setup-seam
                        />
                    </div>
                    <ShellTopBar
                        showBack={!!showBackButton && chrome.back !== false}
                        onBack={onBack}
                        progress={chrome.dots === false ? null : (progress ?? null)}
                        showLanguage={chrome.lang !== false}
                        reduced={reducedMotion}
                    />
                    <ShellFooter spec={screen?.footer ?? null} reduced={reducedMotion} />
                </div>
            </SignupScreenContext.Provider>
        </SetupShellContext.Provider>
    )
}
