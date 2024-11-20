import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface RollingNumberProps {
    number: number
    total: number
    duration?: number
    className?: string
}

const RollingNumber = ({ number, total, duration = 2000, className }: RollingNumberProps) => {
    const [displayNumber, setDisplayNumber] = useState(0)

    useEffect(() => {
        let startTime: number | null = null
        let animationFrame: number

        const easeOutQuart = (x: number): number => {
            return 1 - Math.pow(1 - x, 4)
        }

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp
            const progress = timestamp - startTime
            const percentage = Math.min(progress / duration, 1)

            const easedProgress = easeOutQuart(percentage)
            setDisplayNumber(Math.round(number * easedProgress))

            if (progress < duration) {
                animationFrame = requestAnimationFrame(animate)
            } else {
                setDisplayNumber(number)
            }
        }

        animationFrame = requestAnimationFrame(animate)

        return () => {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame)
            }
        }
    }, [number, duration])

    return (
        <span className={twMerge('inline-block', className)}>
            {displayNumber}/{total}
        </span>
    )
}

export default RollingNumber
