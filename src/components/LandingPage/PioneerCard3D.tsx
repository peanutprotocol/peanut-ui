'use client'
import { motion, useMotionValue, useTransform, useSpring, useMotionTemplate, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { CARD_GRADIENT_4, CARD_GRADIENT_5, CARD_GRADIENT_9, CARD_GRADIENT_10 } from '@/assets/cards'
import { useRef, useState, useEffect, useCallback } from 'react'

const CARD_BACKGROUNDS = [CARD_GRADIENT_4, CARD_GRADIENT_9, CARD_GRADIENT_10, CARD_GRADIENT_5]
const CYCLE_INTERVAL = 3000

interface PioneerCard3DProps {
    className?: string
}

const PioneerCard3D = ({ className }: PioneerCard3DProps) => {
    const cardRef = useRef<HTMLDivElement>(null)
    const [activeIndex, setActiveIndex] = useState(0)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    const x = useMotionValue(0)
    const y = useMotionValue(0)

    const rotateX = useTransform(y, [-100, 100], [12, -12])
    const rotateY = useTransform(x, [-100, 100], [-12, 12])

    const shadowX = useTransform(x, [-100, 100], [14, -2])
    const shadowY = useTransform(y, [-100, 100], [14, -2])

    const springRotateX = useSpring(rotateX, { stiffness: 200, damping: 25 })
    const springRotateY = useSpring(rotateY, { stiffness: 200, damping: 25 })
    const springShadowX = useSpring(shadowX, { stiffness: 200, damping: 25 })
    const springShadowY = useSpring(shadowY, { stiffness: 200, damping: 25 })

    const boxShadow = useMotionTemplate`${springShadowX}px ${springShadowY}px 0 #000000`

    const advance = useCallback(() => {
        setActiveIndex((prev) => (prev + 1) % CARD_BACKGROUNDS.length)
    }, [])

    const resetTimer = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = setInterval(advance, CYCLE_INTERVAL)
    }, [advance])

    useEffect(() => {
        resetTimer()
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [resetTimer])

    // Mobile auto-oscillation: slow sine wave to show off parallax without interaction
    useEffect(() => {
        const isMobile = window.matchMedia('(max-width: 768px)').matches
        if (!isMobile) return

        let frame: number
        const startTime = Date.now()

        const animate = () => {
            const elapsed = (Date.now() - startTime) / 1000
            // gentle figure-8 pattern using offset sine waves
            x.set(Math.sin(elapsed * 0.4) * 60)
            y.set(Math.sin(elapsed * 0.3 + 1) * 40)
            frame = requestAnimationFrame(animate)
        }

        frame = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(frame)
    }, [x, y])

    const handleClick = () => {
        advance()
        resetTimer()
    }

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return

        const rect = cardRef.current.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        const mouseX = e.clientX - centerX
        const mouseY = e.clientY - centerY

        x.set(mouseX)
        y.set(mouseY)
    }

    const handleMouseLeave = () => {
        x.set(0)
        y.set(0)
    }

    return (
        <div
            ref={cardRef}
            className={`inline-block w-full max-w-96 ${className || ''}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ perspective: '1000px' }}
        >
            <motion.div
                className="relative aspect-[384/240] w-full cursor-pointer overflow-hidden"
                style={{
                    rotateX: springRotateX as unknown as number,
                    rotateY: springRotateY as unknown as number,
                    transformStyle: 'preserve-3d',
                    borderRadius: '5.35%',
                    border: '2px solid #000000',
                    boxShadow,
                }}
                onClick={handleClick}
            >
                {/* Card background images with crossfade */}
                <AnimatePresence mode="popLayout">
                    <motion.div
                        key={activeIndex}
                        className="absolute -inset-px"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6, ease: 'easeInOut' }}
                    >
                        <Image
                            src={CARD_BACKGROUNDS[activeIndex]}
                            alt="Card design"
                            fill
                            className="object-cover"
                            priority
                        />
                    </motion.div>
                </AnimatePresence>
            </motion.div>
        </div>
    )
}

export default PioneerCard3D
