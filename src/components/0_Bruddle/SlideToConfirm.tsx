'use client'

import { type FC, useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { twMerge } from '@/utils/tw'
import { Icon } from '../Global/Icons/Icon'

interface SlideToConfirmProps {
    /** Text shown centered in the track ("Slide to Lock"). */
    label: string
    /** Fires once when the handle reaches the end of the track. */
    onConfirm: () => void
    disabled?: boolean
    className?: string
}

// board handle is 40px round with a 3px inset inside the 48px pill (ruled: keep 40)
const HANDLE_SIZE = 40
const HANDLE_INSET = 3
// keyboard travel per arrow press, as a ratio of full travel
const KEY_STEP = 0.1
// clamped drag can land a hair under maxTravel; treat within half a px as complete
const COMPLETE_EPSILON = 0.5

/**
 * The one slide-to-confirm control, from the button board 17785:11764
 * (button.slide.*): white pill with 4px shadow, bold centered label, round
 * action-primary handle; a trailing gradient shows slide progress while
 * dragging; disabled is not draggable. commits only at 100% travel — by drag
 * or by arrow-key presses (no instant keyboard confirm: this control exists
 * to add friction to money actions). the completed latch resets when
 * `disabled` goes true -> false, so hosts that disable while the action runs
 * (card lock/cancel) get in-place retry after a failure for free.
 */
const SlideToConfirm: FC<SlideToConfirmProps> = ({ label, onConfirm, disabled = false, className }) => {
    const trackRef = useRef<HTMLDivElement>(null)
    const [trackWidth, setTrackWidth] = useState(0)
    const x = useMotionValue(0)
    const [completed, setCompleted] = useState(false)
    const wasDisabled = useRef(disabled)

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

    // latch reset: host disabled us while running onConfirm, then re-enabled
    // after a failure -> spring back and allow another attempt
    useEffect(() => {
        if (wasDisabled.current && !disabled && completed) {
            setCompleted(false)
            animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 })
        }
        wasDisabled.current = disabled
    }, [disabled, completed, x])

    const complete = () => {
        setCompleted(true)
        animate(x, maxTravel, { duration: 0.12 })
        onConfirm()
    }

    const handleDragEnd = () => {
        if (disabled || completed) return
        if (maxTravel > 0 && x.get() >= maxTravel - COMPLETE_EPSILON) {
            complete()
        } else {
            animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 })
        }
    }

    return (
        <div
            ref={trackRef}
            className={twMerge(
                'relative flex h-12 w-full items-center overflow-hidden rounded-round border border-border-button-secondary bg-background-default shadow-4',
                disabled && 'opacity-40',
                className
            )}
            aria-label={label}
        >
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-button-l text-foreground-primary">
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
                    if (disabled || completed || maxTravel <= 0) return
                    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                        e.preventDefault()
                        const dir = e.key === 'ArrowRight' ? 1 : -1
                        // set, not animate: keeps rapid presses deterministic
                        const next = Math.min(maxTravel, Math.max(0, x.get() + dir * maxTravel * KEY_STEP))
                        if (next >= maxTravel - COMPLETE_EPSILON) {
                            complete()
                        } else {
                            x.set(next)
                        }
                    }
                }}
                disabled={disabled}
                className="absolute left-[3px] z-10 flex size-10 cursor-grab items-center justify-center rounded-round border border-border-button bg-action-primary focus-visible:outline-[3px] focus-visible:outline-action-focus active:cursor-grabbing"
                aria-label={label}
            >
                <Icon name="chevron-right" size={20} className="text-foreground-primary" />
            </motion.button>
        </div>
    )
}

export default SlideToConfirm
