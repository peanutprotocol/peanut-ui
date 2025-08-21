import React, { useLayoutEffect, useMemo, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

interface TooltipContentProps {
    content: string | React.ReactNode
    position: TooltipPosition
    coords: { top: number; left: number; width: number; height: number }
    contentClassName?: string
    updatePosition: (position: TooltipPosition) => void
    initialPosition: TooltipPosition
}

export const TooltipContent = ({
    content,
    position,
    coords,
    contentClassName,
    updatePosition,
    initialPosition,
}: TooltipContentProps) => {
    const tooltipRef = useRef<HTMLDivElement>(null)

    useLayoutEffect(() => {
        if (tooltipRef.current) {
            const tooltipRect = tooltipRef.current.getBoundingClientRect()
            const { innerWidth, innerHeight } = window

            if (position === initialPosition) {
                let newPosition = position
                switch (initialPosition) {
                    case 'top':
                        if (tooltipRect.top < 0) {
                            newPosition = 'bottom'
                        } else if (tooltipRect.right > innerWidth) {
                            newPosition = 'left'
                        } else if (tooltipRect.left < 0) {
                            newPosition = 'right'
                        }
                        break
                    case 'bottom':
                        if (tooltipRect.bottom > innerHeight) {
                            newPosition = 'top'
                        } else if (tooltipRect.right > innerWidth) {
                            newPosition = 'left'
                        } else if (tooltipRect.left < 0) {
                            newPosition = 'right'
                        }
                        break
                    case 'left':
                        if (tooltipRect.left < 0) {
                            newPosition = 'right'
                        } else if (tooltipRect.top < 0) {
                            newPosition = 'bottom'
                        } else if (tooltipRect.bottom > innerHeight) {
                            newPosition = 'top'
                        }
                        break
                    case 'right':
                        if (tooltipRect.right > innerWidth) {
                            newPosition = 'left'
                        } else if (tooltipRect.top < 0) {
                            newPosition = 'bottom'
                        } else if (tooltipRect.bottom > innerHeight) {
                            newPosition = 'top'
                        }
                        break
                }

                if (newPosition !== position) {
                    updatePosition(newPosition)
                }
            }
        }
    }, [coords, position, initialPosition, updatePosition])

    const getPositionStyles = (): React.CSSProperties => {
        const { top, left, width, height } = coords
        const offset = 8 // space between trigger and tooltip

        switch (position) {
            case 'top':
                return { top: top - offset, left: left + width / 2, transform: 'translate(-50%, -100%)' }
            case 'bottom':
                return { top: top + height + offset, left: left + width / 2, transform: 'translateX(-50%)' }
            case 'left':
                return { top: top + height / 2, left: left - offset, transform: 'translate(-100%, -50%)' }
            case 'right':
                return { top: top + height / 2, left: left + width + offset, transform: 'translateY(-50%)' }
            default:
                return {}
        }
    }

    const getArrowClasses = () => {
        const base = 'absolute h-2 w-2 rotate-45 border-n-1 bg-white'
        switch (position) {
            case 'top':
                return twMerge(base, 'bottom-[-5px] left-1/2 -translate-x-1/2 border-b border-r')
            case 'bottom':
                return twMerge(base, 'top-[-5px] left-1/2 -translate-x-1/2 border-l border-t')
            case 'left':
                return twMerge(base, 'right-[-5px] top-1/2 -translate-y-1/2 border-r border-t')
            case 'right':
                return twMerge(base, 'left-[-5px] top-1/2 -translate-y-1/2 border-l border-b')
        }
    }

    const tooltipClasses: HTMLDivElement['className'] = useMemo(
        () =>
            twMerge(
                'relative w-max max-w-[240px] rounded-md border border-n-1 bg-white px-3 py-2 text-sm font-medium text-black shadow-sm',
                contentClassName
            ),
        [contentClassName, position] // re-runs if position or contentClassName changes
    )

    return (
        <div ref={tooltipRef} style={getPositionStyles()} className="fixed z-50">
            <div role="tooltip" className={tooltipClasses}>
                {content}
                <div className={getArrowClasses()} />
            </div>
        </div>
    )
}
