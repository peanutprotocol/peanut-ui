'use client'
import { motion, useMotionValue, useTransform, useSpring, useMotionTemplate } from 'framer-motion'
import Image from 'next/image'
import peanutLogo from '@/assets/peanut/peanutman-logo.svg'
import { useRef } from 'react'

interface PioneerCard3DProps {
    className?: string
}

const PioneerCard3D = ({ className }: PioneerCard3DProps) => {
    const cardRef = useRef<HTMLDivElement>(null)

    const x = useMotionValue(0)
    const y = useMotionValue(0)

    const rotateX = useTransform(y, [-100, 100], [12, -12])
    const rotateY = useTransform(x, [-100, 100], [-12, 12])

    // Shadow parallax - shadow moves opposite to card tilt
    // Default: 6px right, 6px down (light source top-left)
    const shadowX = useTransform(x, [-100, 100], [14, -2])
    const shadowY = useTransform(y, [-100, 100], [14, -2])

    const springRotateX = useSpring(rotateX, { stiffness: 200, damping: 25 })
    const springRotateY = useSpring(rotateY, { stiffness: 200, damping: 25 })
    const springShadowX = useSpring(shadowX, { stiffness: 200, damping: 25 })
    const springShadowY = useSpring(shadowY, { stiffness: 200, damping: 25 })

    // Create dynamic box shadow with motion template
    const boxShadow = useMotionTemplate`${springShadowX}px ${springShadowY}px 0 #000000`

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
            className={`inline-block ${className || ''}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={
                {
                    perspective: '1000px',
                    '--card-scale': 'min(1, calc(100vw / 420))',
                } as React.CSSProperties
            }
        >
            <motion.div
                className="relative h-60 w-96 cursor-pointer overflow-hidden rounded-xl border border-n-1 bg-primary-1 px-6 py-5"
                style={{
                    rotateX: springRotateX as unknown as number,
                    rotateY: springRotateY as unknown as number,
                    transformStyle: 'preserve-3d',
                    transform: 'scale(var(--card-scale, 1))',
                    boxShadow,
                }}
            >
                {/* Logo in top right corner - mirrored */}
                <div className="relative z-10 mb-8 flex justify-end">
                    <Image src={peanutLogo} alt="Peanut" width={28} height={28} className="scale-x-[-1]" />
                </div>

                {/* Card number */}
                <div className="relative z-10 mb-6 text-left">
                    <div className="mb-1 text-h4 text-white">3400 5678 9804 3002</div>
                    <div className="text-xs font-medium text-white">Card number</div>
                </div>

                {/* Cardholder and expiry */}
                <div className="relative z-10 flex justify-between text-left">
                    <div>
                        <div className="mb-0.5 font-bold text-white">Pioneer Member</div>
                        <div className="text-xs font-medium text-white">Cardholder</div>
                    </div>
                    <div className="text-right">
                        <div className="mb-0.5 font-bold text-white">06 / 26</div>
                        <div className="text-xs font-medium text-white">Valid</div>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}

export default PioneerCard3D
