'use client'

import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { twMerge } from '@/utils/tw'
import { CrossfadeLabel } from './CrossfadeLabel'
import type { SetupFooterSpec, SetupFooterStack } from './shell.types'

/** The last footer edge must end at least this far above the bottom of the shell (mock r9: the 16 px rule). */
const FOOT_GAP = 16

const labelId = (label: ReactNode) => (typeof label === 'string' || typeof label === 'number' ? String(label) : 'node')

/**
 * The fixed footer: the primary button's top is the same on every screen (mock CTA top 698 / 468). A two-button
 * stack lifts 20 px on a small phone (44 px with a link line under the buttons), and so does a one-button footer
 * whose note would end less than 16 px above the bottom edge ('n'). Between lifts the footer glides with the
 * step (500 ms). Mock: scaffold core/shell.js setFooter / fitFooter, core/shell.css .footer.
 */
export function ShellFooter({ spec, reduced }: { spec: SetupFooterSpec | null; reduced: boolean }) {
    const rootRef = useRef<HTMLDivElement>(null)
    const slotRef = useRef<HTMLDivElement>(null)
    const reserveRef = useRef<HTMLDivElement>(null)
    const belowRef = useRef<HTMLDivElement>(null)
    const [noteLift, setNoteLift] = useState(false)
    const base: SetupFooterStack = spec?.secondary ? (spec.below ? '3' : '2') : '1'

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
    const stack: SetupFooterStack = base === '1' && noteLift ? 'n' : base
    const lift = stack === '3' ? 'var(--sr-lift-3)' : stack === '1' ? '0px' : 'var(--sr-lift-2)'
    const { primary, secondary } = spec

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
                onClick={primary.onClick}
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
                        onClick={secondary.onClick}
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
                        >
                            {spec.below}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
