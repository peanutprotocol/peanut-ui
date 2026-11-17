'use client'

import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { twMerge } from '@/utils/tw'
import { CrossfadeLabel } from './CrossfadeLabel'
import type { SetupFooterSpec, SetupFooterStack } from './shell.types'

/** The last footer edge must end at least this far above the bottom of the shell (mock r9: the 16 px rule). */
const FOOT_GAP = 16
/** A footer that would still run off the bottom (large system text, a short window) rises until it ends this far above it. */
const FIT_GAP = 4

const px = (value: string) => parseFloat(value) || 0

const labelId = (label: ReactNode) => (typeof label === 'string' || typeof label === 'number' ? String(label) : 'node')

/**
 * The fixed footer: the primary button's top is the same on every screen (mock CTA top 698 / 468). A two-button
 * stack lifts 20 px on a small phone (44 px with a link line under the buttons), and so does a one-button footer
 * whose note would end less than 16 px above the bottom edge ('n'). Between lifts the footer glides with the
 * step (500 ms). Mock: scaffold core/shell.js setFooter / fitFooter, core/shell.css .footer.
 */
export function ShellFooter({
    spec,
    latest,
    reduced,
    guard,
    onTop,
}: {
    spec: SetupFooterSpec | null
    /** The screen's latest footer: its callbacks change on every render without a footer re-render. */
    latest: () => SetupFooterSpec | null
    reduced: boolean
    /** The shell's navigation lock: a tap runs only when no step is in flight (one step per tap gesture). */
    guard: (run: () => void) => void
    /** Where the footer's top edge rests, in shell px after its lifts (null: no footer). The panel ends there. */
    onTop: (top: number | null) => void
}) {
    const rootRef = useRef<HTMLDivElement>(null)
    const slotRef = useRef<HTMLDivElement>(null)
    const reserveRef = useRef<HTMLDivElement>(null)
    const belowRef = useRef<HTMLDivElement>(null)
    const [noteLift, setNoteLift] = useState(false)
    const [fitLift, setFitLift] = useState(0)
    const base: SetupFooterStack = spec?.secondary ? (spec.below ? '3' : '2') : '1'
    const stack: SetupFooterStack = base === '1' && noteLift ? 'n' : base
    const liftVar = stack === '3' ? '--sr-lift-3' : stack === '1' ? null : '--sr-lift-2'

    // The footer must end on screen at any text size, and the panel must know where it starts. Measured without
    // the transform: offsetTop and rects relative to the footer ignore the glide.
    useLayoutEffect(() => {
        const root = rootRef.current
        const shell = root?.offsetParent as HTMLElement | null
        if (!root || !shell) {
            onTop(null)
            return
        }
        const measure = () => {
            const rootTop = root.getBoundingClientRect().top
            let end = 0
            for (const el of Array.from(root.querySelectorAll('button, a'))) {
                const rect = el.getBoundingClientRect()
                if (rect.height) end = Math.max(end, rect.bottom - rootTop)
            }
            for (const el of [slotRef.current, belowRef.current]) {
                if (!el) continue
                const range = document.createRange()
                range.selectNodeContents(el)
                const rect = range.getBoundingClientRect()
                if (rect.height) end = Math.max(end, rect.bottom - rootTop)
            }
            const lift = liftVar ? px(getComputedStyle(shell).getPropertyValue(liftVar)) : 0
            const top = root.offsetTop - lift
            const extra = Math.max(0, Math.ceil(top + end - (shell.clientHeight - FIT_GAP)))
            setFitLift(extra)
            onTop(top - extra)
            shell.style.setProperty('--sr-footer-top', `${top - extra}px`)
        }
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(shell)
        observer.observe(root)
        return () => {
            observer.disconnect()
            shell.style.removeProperty('--sr-footer-top')
            onTop(null)
        }
    }, [liftVar, spec, onTop])

    useLayoutEffect(() => {
        const root = rootRef.current
        const shell = root?.offsetParent as HTMLElement | null
        if (!root || !shell || base !== '1') {
            setNoteLift(false)
            return
        }
        const measure = () => {
            // in shell px without the lift: offsetTop ignores the transform, and so does a rect relative to the footer
            const rootTop = root.getBoundingClientRect().top
            let end = 0
            for (const el of [slotRef.current, reserveRef.current, belowRef.current]) {
                if (!el) continue
                const range = document.createRange()
                range.selectNodeContents(el)
                const rect = range.getBoundingClientRect()
                if (rect.height) end = Math.max(end, root.offsetTop + rect.bottom - rootTop)
            }
            setNoteLift(end > shell.clientHeight - FOOT_GAP)
        }
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(shell)
        return () => observer.disconnect()
    }, [base, spec])

    if (!spec) return null
    const lift = `calc(${liftVar ? `var(${liftVar})` : '0px'} + ${fitLift}px)`
    const { primary, secondary } = spec
    const tap = (which: 'primary' | 'secondary') => guard(() => latest()?.[which]?.onClick())

    return (
        <div
            ref={rootRef}
            className="absolute top-[var(--sr-cta-top)] right-[var(--sr-gutter)] left-[var(--sr-gutter)] z-40"
            style={{
                transform: `translateY(calc(-1 * ${lift}))`,
                transition: reduced ? 'none' : 'transform var(--sr-step) var(--sr-ease-step)',
            }}
            data-setup-footer
            data-stack={stack}
        >
            <Button
                variant="primary"
                className="w-full"
                disabled={primary.disabled}
                loading={primary.loading}
                icon={primary.icon}
                onClick={() => tap('primary')}
                data-testid={primary.testId}
            >
                <CrossfadeLabel id={labelId(primary.label)} reduced={reduced}>
                    {primary.label}
                </CrossfadeLabel>
            </Button>
            {secondary ? (
                <div className={twMerge('flex flex-col items-stretch pt-3 signup-sm:pt-2', stack === '3' && 'pt-2')}>
                    <Button
                        variant="secondary"
                        className={twMerge(
                            'w-full',
                            secondary.small && 'px-4 text-center text-body-s leading-4 font-bold text-balance'
                        )}
                        disabled={secondary.disabled}
                        loading={secondary.loading}
                        icon={secondary.icon}
                        onClick={() => tap('secondary')}
                        data-testid={secondary.testId}
                    >
                        {secondary.label}
                    </Button>
                    {spec.below && (
                        <div
                            className={twMerge(
                                'flex h-6 items-center justify-center text-center text-body-xs text-foreground-secondary',
                                stack === '3' ? 'mt-1.5 signup-sm:mt-2' : 'mt-2'
                            )}
                            data-setup-footer-links
                        >
                            {spec.below}
                        </div>
                    )}
                </div>
            ) : (
                <div className="relative">
                    <div
                        ref={slotRef}
                        className="flex min-h-[var(--sr-slot-h)] items-center justify-center text-center text-body-xs text-foreground-secondary"
                        data-setup-footer-links
                    >
                        {spec.slot}
                    </div>
                    {spec.reserve && (
                        <div
                            ref={reserveRef}
                            aria-hidden="true"
                            className="pointer-events-none invisible absolute inset-x-0 top-0 flex min-h-[var(--sr-slot-h)] items-center justify-center text-center text-body-xs"
                        >
                            {spec.reserve}
                        </div>
                    )}
                    {spec.below && (
                        <div
                            ref={belowRef}
                            className="flex h-6 items-center justify-center text-center text-body-xs text-foreground-secondary"
                            data-setup-footer-links
                        >
                            {spec.below}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
