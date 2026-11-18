'use client'

import { motion, useIsPresent } from 'framer-motion'
import { type CSSProperties, type ReactNode, useContext, useLayoutEffect, useMemo, useRef } from 'react'
import { twMerge } from '@/utils/tw'
import { GROUND_CLASS, STAGE_HEIGHT_VAR } from './shell.consts'
import { artVariants, panelVariants, stageVariants } from './shell.motion'
import type { SetupChrome, SetupFooterSpec, SetupGround, SetupStageSize } from './shell.types'
import { SetupSlideContext, useSetupShell } from './SetupShellContext'
import { ART_BOX_W, DESIGN_STAGE_PX, useArtScale } from './useArtScale'
import { useShellDevice } from './useShellDevice'

export type SetupScreenProps = {
    ground: SetupGround
    /** Stage height for the current state; a change eases in place (500 ms). Default 'std'. */
    stage?: SetupStageSize
    /** The headline (an h1). Heading-l on the landing (`titleSize="l"`), heading-m elsewhere, heading-s on a small phone. */
    title?: ReactNode
    titleSize?: 'm' | 'l'
    /** Extra classes for the h1 (a narrower measure, the sentence type). */
    titleClassName?: string
    /** One short line under the headline, on the stage (the landing trust line). The art scales to stay below both. */
    subtitle?: ReactNode
    /**
     * The hero: pieces placed in the 390-wide art box, in the mock's design px (top 250 = 250 px from the top of
     * a 390x844 phone). Use ArtPiece, MascotStage and CoinCharacter. The box hangs from the stage bottom, may cross
     * the seam by 40 px, and scales on smaller phones.
     */
    art?: ReactNode
    /** Topmost y of the art in design px; the scale keeps it under the headline. */
    artTop?: number
    /** The same for a separate small-phone layout (default: artTop). */
    smArtTop?: number
    /** A fixed art scale on small phones instead of the computed one. */
    smScale?: number
    /** Hide the whole art box on small phones (the sentence screens). */
    smArt?: boolean
    /** Art set beside the headline, not under it: regular phones keep scale 1 (mock), as the fit would shrink it. */
    artBesideTitle?: boolean
    /** Copy on the stage itself, unscaled, for `stage="full"` (no panel). The caller positions it in the shell. */
    stageCopy?: ReactNode
    chrome?: SetupChrome
    /** The fixed footer, or null for none (the celebration, the web download-only landing). */
    footer: SetupFooterSpec | null
    /** The state shown, for tests and captures (`data-setup-state`). */
    state?: string
    /** `data-testid` on the stage, next to `data-setup-state`. */
    testId?: string
    /** The white panel's content. */
    children?: ReactNode
    panelClassName?: string
}

/**
 * One sign-up screen inside SetupShell: the ground and headline on the stage, the hero in the art layer above
 * the white panel, the panel content, and the fixed footer (drawn by the shell). Mock: scaffold CONTRACT.md § 3.
 */
export function SetupScreen({
    ground,
    stage = 'std',
    title,
    titleSize = 'm',
    titleClassName,
    subtitle,
    art,
    artTop,
    smArtTop,
    smScale,
    smArt = true,
    artBesideTitle = false,
    stageCopy,
    chrome,
    footer,
    state,
    testId,
    children,
    panelClassName,
}: SetupScreenProps) {
    const { store, reducedMotion, onEntered } = useSetupShell()
    const slide = useContext(SetupSlideContext)
    const isPresent = useIsPresent()
    const device = useShellDevice()
    const stageBoxRef = useRef<HTMLDivElement>(null)
    const titleRef = useRef<HTMLDivElement>(null)
    const scale = useArtScale({
        stageRef: stageBoxRef,
        titleRef,
        stage,
        artTop,
        smArtTop,
        smScale,
        artBesideTitle,
        device,
    })

    // Only the screen on show drives the shell; a leaving screen keeps its look while it slides out.
    useLayoutEffect(() => {
        if (!isPresent) return
        store.set({ owner: slide.key, ground, stage, chrome: chrome ?? {}, footer })
    })
    useLayoutEffect(() => () => store.clear(slide.key), [store, slide.key])

    const variants = useMemo(
        () => ({
            stage: stageVariants(reducedMotion),
            art: artVariants(reducedMotion),
            panel: panelVariants(reducedMotion),
        }),
        [reducedMotion]
    )
    const stageH = STAGE_HEIGHT_VAR[stage]
    const designH = DESIGN_STAGE_PX[stage]
    const layoutTransition = reducedMotion ? 'none' : 'var(--sr-step) var(--sr-ease-step)'
    const showArt = !!art && (smArt || device !== 'sm')

    return (
        <>
            <motion.div
                variants={variants.stage}
                custom={slide.direction}
                className={twMerge('absolute inset-0', GROUND_CLASS[ground])}
                onAnimationComplete={(definition) => {
                    if (definition === 'center' && isPresent) onEntered?.(slide.key)
                }}
                data-setup-stage
                data-ground={ground}
                data-setup-state={state}
                data-testid={testId}
            >
                <div
                    ref={stageBoxRef}
                    aria-hidden="true"
                    className="w-full"
                    style={{ height: stageH, transition: `height ${layoutTransition}` }}
                />
            </motion.div>
            {stage !== 'full' && (
                <motion.div
                    variants={variants.panel}
                    custom={slide.direction}
                    className={twMerge(
                        // The panel ends at the footer's top edge and scrolls when its content does not fit (larger
                        // system text, the keyboard, a small window): nothing ever sits under the footer (R2-02, R2-04).
                        // Children keep their size so overflow scrolls instead of squeezing them.
                        'absolute inset-x-0 flex flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-[var(--sr-gutter)] pt-[var(--sr-panel-pad)] *:shrink-0',
                        !isPresent && 'pointer-events-none',
                        panelClassName
                    )}
                    style={
                        {
                            top: stageH,
                            bottom: 'calc(100% - var(--sr-footer-top, 100%))',
                            transition: `top ${layoutTransition}`,
                            '--sr-panel-to-cta': `calc(var(--sr-cta-top) - ${stageH} - var(--sr-panel-pad))`,
                        } as CSSProperties
                    }
                    data-setup-panel
                    inert={!isPresent}
                >
                    {children}
                </motion.div>
            )}
            <motion.div
                variants={variants.art}
                custom={slide.direction}
                className="pointer-events-none absolute inset-0"
                data-setup-art-layer
            >
                {showArt && (
                    <div
                        className="absolute left-1/2"
                        style={{
                            width: ART_BOX_W,
                            height: designH,
                            bottom: `calc(100% - ${stageH})`,
                            transform: `translateX(-50%) scale(${scale})`,
                            transformOrigin: '50% 100%',
                            transition: `bottom ${layoutTransition}`,
                        }}
                        data-setup-art-box
                    >
                        {art}
                    </div>
                )}
                {title && (
                    // one block for the headline and its line, so the art scale measures both
                    <div
                        ref={titleRef}
                        className="absolute top-[var(--sr-title-top)] right-[var(--sr-gutter)] left-[var(--sr-gutter)] z-10 text-left"
                        data-setup-title
                    >
                        <h1
                            className={twMerge(
                                titleSize === 'l'
                                    ? 'text-heading-l signup-sm:text-heading-m'
                                    : 'text-heading-m signup-sm:text-heading-s',
                                titleClassName
                            )}
                        >
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="mt-2 text-body-m text-foreground-primary" data-setup-subtitle>
                                {subtitle}
                            </p>
                        )}
                    </div>
                )}
                {stageCopy}
            </motion.div>
        </>
    )
}
