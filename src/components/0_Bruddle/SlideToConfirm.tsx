'use client'

import { type FC, useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { twMerge } from 'tailwind-merge'
import { Icon } from '../Global/Icons/Icon'

interface SlideToConfirmProps {
    /** Text shown centered in the track ("Slide to Lock"). */
    label: string
    /** Fires once when the handle is dragged past the threshold (or confirmed via keyboard). */
    onConfirm: () => void
    disabled?: boolean
    /** Complete threshold as a ratio of full travel. 0.9 = user must drag to 90%. */
    threshold?: number
    className?: string
}

// board handle is 40px round with a 3px inset inside the 48px pill
const HANDLE_SIZE = 40
const HANDLE_INSET = 3

/**
 * The one slide-to-confirm control, from the button board 17785:11764
 * (button.slide.*): white pill with 4px shadow, bold centered label, round
 * action-primary handle; a trailing gradient shows slide progress while
 * dragging; disabled is not draggable. keyboard users confirm with
 * enter/space on the focused handle.
 */
const SlideToConfirm: FC<SlideToConfirmProps> = ({
    label,
    onConfirm,
    disabled = false,
    threshold = 0.9,
    className,
}) => {
    const trackRef = useRef<HTMLDivElement>(null)
    const [trackWidth, setTrackWidth] = useState(0)
    const x = useMotionValue(0)
    const [completed, setCompleted] = useState(false)

    const maxTravel = Math.max(0, trackWidth - HANDLE_SIZE - HANDLE_INSET * 2)
    // board active state keeps the label visible; the gradient trail conveys progress
    const trailWidth = useTransform(x, (v) => v + HANDLE_SIZE + HANDLE_INSET)
    const trailOpacity = useTransform(x, [0, Math.max(1, maxTravel * 0.1)], [0, 0.6])

    useEffect(() => {
        if (!trackRef.current) return
        const update = () => {
            if (trackRef.current) setTrackWidth(trackRef.current.clientWidth)
        }
        update()
        const observer = new ResizeObserver(update)
        observer.observe(trackRef.current)
        return () => observer.disconnect()
    }, [])

    const complete = () => {
        setCompleted(true)
        animate(x, maxTravel, { duration: 0.12 })
        onConfirm()
    }

    const handleDragEnd = () => {
        if (disabled || completed) return
        if (maxTravel > 0 && x.get() / maxTravel >= threshold) {
            complete()
        } else {
            animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 })
        }
    }

    return (
        <div
            ref={trackRef}
            className={twMerge(
                'relative flex h-12 w-full items-center overflow-hidden rounded-round border border-border-default bg-background-default shadow-4',
                disabled && 'opacity-60',
                className
            )}
            aria-label={label}
        >
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-body-l font-bold text-foreground-primary">
                {label}
            </span>
            <motion.div
                aria-hidden
                style={{ width: trailWidth, opacity: trailOpacity }}
                className="pointer-events-none absolute inset-y-0 left-0 rounded-round bg-gradient-to-r from-background-default to-action-primary"
            />
            <motion.button
                type="button"
                style={{ x }}
                drag={!disabled && !completed ? 'x' : false}
                dragConstraints={{ left: 0, right: maxTravel }}
                dragElastic={0}
                dragMomentum={false}
                onDragEnd={handleDragEnd}
                onKeyDown={(e) => {
                    if (disabled || completed) return
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        complete()
                    }
                }}
                disabled={disabled}
                className="absolute left-[3px] z-10 flex size-10 cursor-grab items-center justify-center rounded-round border border-border-default bg-action-primary focus-visible:outline-2 focus-visible:outline-action-focus active:cursor-grabbing"
                aria-label={label}
            >
                <Icon name="chevron-right" size={20} className="text-foreground-primary" />
            </motion.button>
        </div>
    )
}

export default SlideToConfirm
