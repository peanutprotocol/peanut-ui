'use client'
import { type FC, useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@/components/Global/Icons/Icon'

interface Props {
    label: string
    onComplete: () => void
    disabled?: boolean
    /** Complete threshold as a ratio of full travel. 0.9 = user must drag to 90%. */
    threshold?: number
    className?: string
}

const HANDLE_WIDTH = 56

const SlideToAction: FC<Props> = ({ label, onComplete, disabled = false, threshold = 0.9, className }) => {
    const trackRef = useRef<HTMLDivElement>(null)
    const [trackWidth, setTrackWidth] = useState(0)
    const x = useMotionValue(0)
    const [completed, setCompleted] = useState(false)

    // Label fades as the handle slides — conveys progress without a separate bar.
    const maxTravel = Math.max(0, trackWidth - HANDLE_WIDTH)
    const labelOpacity = useTransform(x, [0, Math.max(1, maxTravel * 0.6)], [1, 0])

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

    const handleDragEnd = () => {
        if (disabled || completed) return
        const value = x.get()
        if (maxTravel > 0 && value / maxTravel >= threshold) {
            setCompleted(true)
            animate(x, maxTravel, { duration: 0.12 })
            onComplete()
        } else {
            animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 })
        }
    }

    return (
        <div
            ref={trackRef}
            className={twMerge(
                'relative flex h-14 w-full items-center overflow-hidden rounded-sm border border-n-1 bg-primary-1 text-n-1',
                disabled && 'opacity-60',
                className
            )}
            aria-label={label}
        >
            <motion.span
                style={{ opacity: labelOpacity }}
                className="pointer-events-none absolute inset-0 flex items-center justify-center text-base font-bold"
            >
                {label}
            </motion.span>
            <motion.button
                type="button"
                style={{ x, width: HANDLE_WIDTH }}
                drag={!disabled && !completed ? 'x' : false}
                dragConstraints={{ left: 0, right: maxTravel }}
                dragElastic={0}
                dragMomentum={false}
                onDragEnd={handleDragEnd}
                className="z-10 flex h-full cursor-grab items-center justify-center bg-white active:cursor-grabbing"
                aria-label="Slide handle"
            >
                <Icon name="chevron-up" size={24} className="rotate-90" />
            </motion.button>
        </div>
    )
}

export default SlideToAction
