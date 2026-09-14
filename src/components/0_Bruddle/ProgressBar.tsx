'use client'

import React from 'react'
import { twMerge } from '@/utils/tw'

export interface ProgressBarMarker {
    /** 0-100, or 'end' to pin at the right edge */
    position: number | 'end'
    className?: string
    /** optional label rendered above the tick */
    label?: React.ReactNode
}

interface ProgressBarProps {
    /** fill percentage, clamped to 0-100 */
    value: number
    trackClassName?: string
    fillClassName?: string
    markers?: ProgressBarMarker[]
    className?: string
}

/**
 * the one progress bar primitive: track + fill + optional tick markers.
 * consumers own their colors (pass token classes via trackClassName / fillClassName).
 */
const ProgressBar = ({ value, trackClassName, fillClassName, markers, className }: ProgressBarProps) => {
    const clamped = Math.min(Math.max(value, 0), 100)

    return (
        <div className={twMerge('relative flex h-1.5 w-full items-center', className)}>
            <div
                className={twMerge(
                    'absolute left-0 h-full w-full rounded-full bg-background-disabled transition-all duration-moderate',
                    trackClassName
                )}
            />
            <div
                className={twMerge(
                    'absolute left-0 h-full rounded-full bg-green-500 transition-all duration-moderate ease-in-out',
                    fillClassName
                )}
                style={{ width: `${clamped}%` }}
            />
            {markers?.map((marker, i) => (
                <div
                    key={i}
                    className={twMerge(
                        'absolute top-1/2 z-10 -translate-y-1/2 transition-all duration-moderate',
                        marker.position !== 'end' && '-translate-x-1/2'
                    )}
                    style={marker.position === 'end' ? { right: 0 } : { left: `${marker.position}%` }}
                >
                    {marker.label}
                    <div
                        className={twMerge('h-4 w-[3px] rounded-sm transition-all duration-moderate', marker.className)}
                    />
                </div>
            ))}
        </div>
    )
}

export default ProgressBar
