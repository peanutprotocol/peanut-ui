import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from '@/utils/tw'

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

// the screen edge inset (design.md spacing L/16): a panel never sits closer to the edge
const EDGE = 16

interface TooltipContentProps {
    content: string | React.ReactNode
    position: TooltipPosition
    coords: { top: number; left: number; width: number; height: number }
    contentClassName?: string
    updatePosition: (position: TooltipPosition) => void
    initialPosition: TooltipPosition
    id?: string
}

export const TooltipContent = ({
    content,
    position,
    coords,
    contentClassName,
    updatePosition,
    initialPosition,
    id,
}: TooltipContentProps) => {
    const tooltipRef = useRef<HTMLDivElement>(null)
    const [isPositioned, setIsPositioned] = useState(false)
    const [finalPosition, setFinalPosition] = useState(position)
    // how far a top or bottom panel slides sideways to stay EDGE inside the screen
    const [shiftX, setShiftX] = useState(0)

    useLayoutEffect(() => {
        const el = tooltipRef.current
        if (!el) return

        // reset positioning state when coords or content changes
        setIsPositioned(false)

        // use requestAnimationFrame to ensure the tooltip is rendered with content
        const positionTooltip = () => {
            const rect = el.getBoundingClientRect()
            const { innerWidth, innerHeight } = window

            const offset = 8
            const { top, left, width: triggerW, height: triggerH } = coords
            const w = rect.width
            const h = rect.height

            // only proceed if we have valid dimensions
            if (w === 0 || h === 0) {
                requestAnimationFrame(positionTooltip)
                return
            }

            const boundsFor = (p: TooltipPosition) => {
                switch (p) {
                    case 'top': {
                        const y = top - offset - h
                        const x = left + triggerW / 2 - w / 2
                        return { top: y, left: x, right: x + w, bottom: y + h }
                    }
                    case 'bottom': {
                        const y = top + triggerH + offset
                        const x = left + triggerW / 2 - w / 2
                        return { top: y, left: x, right: x + w, bottom: y + h }
                    }
                    case 'left': {
                        const y = top + triggerH / 2 - h / 2
                        const x = left - offset - w
                        return { top: y, left: x, right: x + w, bottom: y + h }
                    }
                    case 'right': {
                        const y = top + triggerH / 2 - h / 2
                        const x = left + triggerW + offset
                        return { top: y, left: x, right: x + w, bottom: y + h }
                    }
                }
            }

            const fits = (p: TooltipPosition) => {
                const b = boundsFor(p)
                if (b.top < 0 || b.bottom > innerHeight) return false
                // top and bottom slide sideways (shiftX), so they only need the width
                if (p === 'top' || p === 'bottom') return w <= innerWidth - 2 * EDGE
                return b.left >= EDGE && b.right <= innerWidth - EDGE
            }

            const preference: Record<TooltipPosition, TooltipPosition[]> = {
                top: ['top', 'bottom', 'right', 'left'],
                bottom: ['bottom', 'top', 'right', 'left'],
                left: ['left', 'right', 'top', 'bottom'],
                right: ['right', 'left', 'top', 'bottom'],
            }

            const candidates = preference[initialPosition]
            const bestPosition = candidates.find(fits) ?? initialPosition

            if (bestPosition !== finalPosition) {
                setFinalPosition(bestPosition)
                updatePosition(bestPosition)
            }
            // TASK-23929: a panel centred on a trigger near the edge ran off the screen
            const b = boundsFor(bestPosition)
            setShiftX(
                bestPosition === 'top' || bestPosition === 'bottom'
                    ? Math.max(EDGE - b.left, Math.min(0, innerWidth - EDGE - b.right))
                    : 0
            )

            setIsPositioned(true)
        }

        requestAnimationFrame(positionTooltip)
    }, [coords, initialPosition, updatePosition, finalPosition])

    const getPositionStyles = useCallback((): React.CSSProperties => {
        const { top, left, width, height } = coords
        const offset = 8

        const baseStyles: React.CSSProperties = {
            // start with opacity 0 until positioned
            opacity: isPositioned ? 1 : 0,
            transition: isPositioned ? 'opacity 0.15s ease-in-out' : 'none',
        }

        switch (finalPosition) {
            case 'top':
                return {
                    ...baseStyles,
                    top: top - offset,
                    left: left + width / 2 + shiftX,
                    transform: 'translate(-50%, -100%)',
                }
            case 'bottom':
                return {
                    ...baseStyles,
                    top: top + height + offset,
                    left: left + width / 2 + shiftX,
                    transform: 'translateX(-50%)',
                }
            case 'left':
                return {
                    ...baseStyles,
                    top: top + height / 2,
                    left: left - offset,
                    transform: 'translate(-100%, -50%)',
                }
            case 'right':
                return {
                    ...baseStyles,
                    top: top + height / 2,
                    left: left + width + offset,
                    transform: 'translateY(-50%)',
                }
            default:
                return baseStyles
        }
    }, [coords, finalPosition, isPositioned, shiftX])

    const getArrowClasses = useCallback(() => {
        const base = 'absolute h-2 w-2 rotate-45 border-border-default bg-white'
        switch (finalPosition) {
            case 'top':
                return twMerge(base, 'bottom-[-5px] left-1/2 -translate-x-1/2 border-b border-r')
            case 'bottom':
                return twMerge(base, 'top-[-5px] left-1/2 -translate-x-1/2 border-l border-t')
            case 'left':
                return twMerge(base, 'right-[-5px] top-1/2 -translate-y-1/2 border-r border-t')
            case 'right':
                return twMerge(base, 'left-[-5px] top-1/2 -translate-y-1/2 border-l border-b')
        }
    }, [finalPosition])

    const tooltipClasses: HTMLDivElement['className'] = useMemo(
        () =>
            twMerge(
                'relative z-50 w-max max-w-[230px] rounded-sm border border-border-default bg-background-default px-3 py-2 text-body-s text-foreground-primary shadow-sm',
                contentClassName
            ),
        [contentClassName]
    )

    return (
        <div key={id} ref={tooltipRef} style={getPositionStyles()} className="pointer-events-none fixed z-50">
            <div id={id} role="tooltip" className={tooltipClasses}>
                {content}
                {/* the arrow stays on the trigger when the panel slides */}
                <div
                    className={getArrowClasses()}
                    style={
                        shiftX && (finalPosition === 'top' || finalPosition === 'bottom')
                            ? { left: `calc(50% - ${shiftX}px)` }
                            : undefined
                    }
                />
            </div>
        </div>
    )
}
